import { defineStore } from 'pinia'
import type { Approval, ChatActionCard, ChatMessage, Task } from '~/types'

type ChatRuntimeMode = 'nexoria' | 'openclaw' | 'power-agent'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const openClawSessionId = ref<string | null>(null)
  const openClawStreamAbort = ref<AbortController | null>(null)
  const openClawStreamingMessageId = ref<string | null>(null)
  const seenActionCards = ref<Set<string>>(new Set())
  const activeTurnStartedAt = ref<string | null>(null)
  let actionCardPollTimer: ReturnType<typeof setInterval> | null = null
  let actionCardPollAttempts = 0

  async function sendMessage (content: string, agentProfileId: string = 'orchestrator', runtimeMode: ChatRuntimeMode = 'nexoria', files: File[] = []): Promise<void> {
    const workspaceId = await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId) throw new Error('No workspace selected')
    stopActionCardPolling()
    const uploadedAttachments = files.length ? await useAttachments().uploadFiles(files, { scope: 'chat' }) : []

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      attachments: uploadedAttachments,
      timestamp: new Date().toISOString()
    }
    activeTurnStartedAt.value = userMsg.timestamp
    messages.value.push(userMsg)
    isLoading.value = true
    error.value = null

    try {
      if (runtimeMode === 'openclaw') {
        await runOpenClawChat(workspaceId, agentProfileId, content, uploadedAttachments.map(attachment => attachment.id))
      } else if (runtimeMode === 'power-agent') {
        await runPowerAgentChat(workspaceId, agentProfileId, content)
      } else {
        const assistantContent = await runNexoriaChat(workspaceId, agentProfileId, content)
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: assistantContent,
          agentProfileId,
          timestamp: new Date().toISOString()
        }
        messages.value.push(assistantMsg)
      }
      await useTasksStore().fetchTasks(workspaceId)
      if (runtimeMode === 'nexoria') {
        await appendWorkspaceActionCards(workspaceId, userMsg.timestamp)
        startActionCardPolling(workspaceId, userMsg.timestamp)
      }
    } catch (e: any) {
      error.value = e?.message || 'Failed to get response'
      messages.value.push({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error: ${error.value}`,
        timestamp: new Date().toISOString()
      })
    } finally {
      if (runtimeMode === 'nexoria') isLoading.value = false
    }
  }

  async function runNexoriaChat (workspaceId: string, agentProfileId: string, content: string): Promise<string> {
    const res = await useApi<{ message: string; task?: any; status: string }>(
      `/workspaces/${workspaceId}/agent-runtime/run/${agentProfileId}`,
      {
        method: 'POST',
        body: { message: content }
      }
    )
    return res.message || 'Task dispatched.'
  }

  async function runPowerAgentChat (workspaceId: string, agentProfileId: string, content: string): Promise<void> {
    isLoading.value = true
    try {
      const res = await useApi<{ id: string; type: string; status: string; payload: Record<string, any>; result?: Record<string, any> }>(
        `/agent-hub/tasks`,
        {
          method: 'POST',
          body: {
            type: 'chat',
            payload: { agentProfileId, content, workspaceId }
          }
        }
      )
      const taskId = res.id
      const placeholder: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Thinking...',
        agentProfileId,
        timestamp: new Date().toISOString()
      }
      messages.value.push(placeholder)

      const pollInterval = 2000
      const maxPolls = 60
      let polls = 0
      const poll = async (): Promise<void> => {
        try {
          const task = await useApi<{ id: string; status: string; result?: Record<string, any>; error?: string }>(`/agent-hub/tasks/${taskId}`)
          if (task.status === 'completed' && task.result) {
            placeholder.content = task.result.message || task.result.content || JSON.stringify(task.result)
            isLoading.value = false
            return
          }
          if (task.status === 'failed') {
            placeholder.content = task.error || 'Power agent task failed.'
            isLoading.value = false
            return
          }
          polls++
          if (polls >= maxPolls) {
            placeholder.content = 'Power agent is still processing. Check back later.'
            isLoading.value = false
            return
          }
          await new Promise(r => setTimeout(r, pollInterval))
          await poll()
        } catch {
          placeholder.content = 'Lost connection to power agent.'
          isLoading.value = false
        }
      }
      void poll()
    } catch (e: any) {
      error.value = e?.message || 'Power agent request failed'
      messages.value.push({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error: ${error.value}`,
        timestamp: new Date().toISOString()
      })
    } finally {
      isLoading.value = false
    }
  }

  async function runOpenClawChat (workspaceId: string, agentProfileId: string, content: string, attachmentIds: string[] = []): Promise<void> {
    const session = await ensureOpenClawSession(workspaceId, agentProfileId)
    startOpenClawStream(workspaceId, session.id, agentProfileId)
    await useApi<any>(`/workspaces/${workspaceId}/runtime/chat/sessions/${session.id}/messages`, {
      method: 'POST',
      body: { content, attachmentIds }
    })
  }

  async function ensureOpenClawSession (workspaceId: string, agentProfileId: string): Promise<any> {
    const storageKey = openClawSessionStorageKey(workspaceId, agentProfileId)
    const savedSessionId = openClawSessionId.value || (process.client ? localStorage.getItem(storageKey) : null)
    if (savedSessionId) {
      try {
        const session = await useApi<any>(`/workspaces/${workspaceId}/runtime/chat/sessions/${savedSessionId}`)
        openClawSessionId.value = session.id
        if (messages.value.length === 0) await loadOpenClawMessages(workspaceId, session.id)
        return session
      } catch {
        if (process.client) localStorage.removeItem(storageKey)
        openClawSessionId.value = null
      }
    }

    const session = await useApi<any>(`/workspaces/${workspaceId}/runtime/chat/sessions`, {
      method: 'POST',
      body: { agentProfileId }
    })
    openClawSessionId.value = session.id
    if (process.client) localStorage.setItem(storageKey, session.id)
    return session
  }

  async function startTaskChatSession (workspaceId: string, taskId: string): Promise<any> {
    const session = await useApi<any>(`/workspaces/${workspaceId}/tasks/${taskId}/chat/sessions`, {
      method: 'POST'
    })
    openClawSessionId.value = session.id
    const storageKey = openClawSessionStorageKey(workspaceId, session.agentProfileId || 'orchestrator')
    if (process.client) localStorage.setItem(storageKey, session.id)
    return session
  }

  async function loadOpenClawMessages (workspaceId: string, sessionId: string): Promise<void> {
    const persisted = await useApi<any[]>(`/workspaces/${workspaceId}/runtime/chat/sessions/${sessionId}/messages`)
    messages.value = persisted.map(message => toChatMessage(message))
  }

  function startOpenClawStream (workspaceId: string, sessionId: string, agentProfileId: string): void {
    if (openClawStreamAbort.value) return
    const controller = new AbortController()
    openClawStreamAbort.value = controller
    void readOpenClawStream(workspaceId, sessionId, agentProfileId, controller)
  }

  async function readOpenClawStream (workspaceId: string, sessionId: string, agentProfileId: string, controller: AbortController): Promise<void> {
    try {
      const response = await useApiStream(`/workspaces/${workspaceId}/runtime/chat/sessions/${sessionId}/events`, {
        signal: controller.signal,
        headers: { Accept: 'text/event-stream' }
      })
      if (!response.ok || !response.body) throw new Error(`OpenClaw stream failed (${response.status})`)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() || ''
        for (const chunk of chunks) void handleOpenClawSseChunk(chunk, workspaceId, agentProfileId)
      }
    } catch (e: any) {
      if (!controller.signal.aborted) {
        error.value = e?.message || 'OpenClaw stream disconnected'
        addSystemMessage(`Error: ${error.value}`)
      }
    } finally {
      if (openClawStreamAbort.value === controller) openClawStreamAbort.value = null
    }
  }

  async function handleOpenClawSseChunk (chunk: string, workspaceId: string, agentProfileId: string): Promise<void> {
    const dataLine = chunk.split('\n').find(line => line.startsWith('data:'))
    if (!dataLine) return
    try {
      const event = JSON.parse(dataLine.replace(/^data:\s*/, ''))
      if (event.type === 'assistant_delta') {
        appendAssistantDelta(event.content || '', agentProfileId)
      } else if (event.type === 'assistant_final' && event.message) {
        replaceStreamingAssistant(toChatMessage(event.message, agentProfileId))
        const turnStartedAt = activeTurnStartedAt.value
        await appendWorkspaceActionCards(workspaceId, turnStartedAt)
        await useTasksStore().fetchTasks(workspaceId)
        startActionCardPolling(workspaceId, turnStartedAt)
        isLoading.value = false
        activeTurnStartedAt.value = null
      } else if (event.type === 'error' && event.message) {
        messages.value.push(toChatMessage(event.message, agentProfileId))
        isLoading.value = false
      } else if (event.type === 'policy_violation' && event.message) {
        messages.value.push(toChatMessage(event.message, agentProfileId))
        isLoading.value = false
      } else if (event.type === 'status' && event.content) {
        addSystemMessage(event.content)
      }
    } catch {
      // Ignore malformed keepalive or partial SSE chunks.
    }
  }

  function appendAssistantDelta (content: string, agentProfileId: string): void {
    if (!content) return
    let message = messages.value.find(item => item.id === openClawStreamingMessageId.value)
    if (!message) {
      message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        agentProfileId,
        timestamp: new Date().toISOString()
      }
      openClawStreamingMessageId.value = message.id
      messages.value.push(message)
    }
    message.content += content
  }

  function replaceStreamingAssistant (message: ChatMessage): void {
    const index = openClawStreamingMessageId.value
      ? messages.value.findIndex(item => item.id === openClawStreamingMessageId.value)
      : -1
    if (index >= 0) {
      messages.value[index] = message
    } else if (!messages.value.some(item => item.id === message.id)) {
      messages.value.push(message)
    }
    openClawStreamingMessageId.value = null
  }

  function toChatMessage (message: any, fallbackAgentProfileId?: string): ChatMessage {
    return {
      id: message.id || crypto.randomUUID(),
      role: message.role === 'tool' ? 'system' : message.role,
      content: message.content || '',
      agentProfileId: message.metadata?.agentProfileId || fallbackAgentProfileId || null,
      actionCard: message.actionCard || message.metadata?.actionCard || null,
      attachments: message.attachments || message.metadata?.attachments || [],
      timestamp: message.createdAt || message.timestamp || new Date().toISOString()
    }
  }

  async function appendWorkspaceActionCards (workspaceId: string, sinceIso?: string | null): Promise<{ total: number; approvals: number; tasks: number }> {
    const [approvals, tasks] = await Promise.all([
      useApi<Approval[]>(`/workspaces/${workspaceId}/approvals`).catch(() => []),
      useApi<Task[]>(`/workspaces/${workspaceId}/tasks`).catch(() => [])
    ]);
    let appendedApprovals = 0
    let appendedTasks = 0
    const sinceMs = sinceIso ? new Date(sinceIso).getTime() - 1000 : Date.now()
    const createdDuringTurn = (item: { createdAt: string }) => new Date(item.createdAt).getTime() >= sinceMs

    const pendingApprovals = approvals
      .filter(approval => approval.status === 'pending')
      .filter(createdDuringTurn)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)

    const recentApprovalTaskIds = new Set(pendingApprovals.map(approval => approval.taskId).filter(Boolean))

    for (const approval of pendingApprovals) {
      const appended = appendActionCard({
        type: 'approval',
        id: approval.id,
        title: approval.title,
        description: approval.description,
        status: approval.status,
        metadata: approval.metadata
      })
      if (appended) appendedApprovals += 1
    }

    const actionableTasks = tasks
      .filter(createdDuringTurn)
      .filter(task => task.status !== 'done' && task.status !== 'cancelled')
      .filter(task => task.metadata?.createdByTool || task.metadata?.handoffQueued || task.metadata?.waitingApproval)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 2)

    for (const task of actionableTasks) {
      if (recentApprovalTaskIds.has(task.id)) continue
      if (task.metadata?.approvalId && pendingApprovals.some(approval => approval.id === task.metadata?.approvalId)) continue
      const appended = appendActionCard({
        type: 'task',
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        metadata: task.metadata
      })
      if (appended) appendedTasks += 1
    }
    return {
      total: appendedApprovals + appendedTasks,
      approvals: appendedApprovals,
      tasks: appendedTasks
    }
  }

  function appendActionCard (actionCard: ChatActionCard): boolean {
    const key = `${actionCard.type}:${actionCard.id}`
    if (seenActionCards.value.has(key)) return false
    seenActionCards.value.add(key)
    const content = actionCard.type === 'approval'
      ? 'Approval created. You can review it here.'
      : 'Task created. You can track it here.'
    messages.value.push({
      id: crypto.randomUUID(),
      role: 'system',
      content,
      actionCard,
      timestamp: new Date().toISOString()
    })
    return true
  }

  function startActionCardPolling (workspaceId: string, sinceIso?: string | null): void {
    if (!process.client || !sinceIso) return
    stopActionCardPolling()
    actionCardPollAttempts = 0
    actionCardPollTimer = setInterval(() => {
      actionCardPollAttempts += 1
      void (async () => {
        try {
          const appended = await appendWorkspaceActionCards(workspaceId, sinceIso)
          await useTasksStore().fetchTasks(workspaceId)
          if (appended.approvals > 0 || actionCardPollAttempts >= 40) {
            stopActionCardPolling()
          }
        } catch {
          if (actionCardPollAttempts >= 40) stopActionCardPolling()
        }
      })()
    }, 3000)
  }

  function stopActionCardPolling (): void {
    if (actionCardPollTimer) clearInterval(actionCardPollTimer)
    actionCardPollTimer = null
    actionCardPollAttempts = 0
  }

  function openClawSessionStorageKey (workspaceId: string, agentProfileId: string): string {
    return `nexoria:openclaw-session:${workspaceId}:${agentProfileId}`
  }

  function clearMessages (): void {
    stopActionCardPolling()
    messages.value = []
    openClawStreamingMessageId.value = null
    seenActionCards.value = new Set()
  }

  function addSystemMessage (content: string): void {
    messages.value.push({
      id: crypto.randomUUID(),
      role: 'system',
      content,
      timestamp: new Date().toISOString()
    })
  }

  return {
    messages,
    isLoading,
    error,
    openClawSessionId,
    sendMessage,
    startTaskChatSession,
    clearMessages,
    addSystemMessage
  }
})
