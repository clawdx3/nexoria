import { defineStore } from 'pinia'
import type { Approval, ChatActionCard, ChatMessage, Task } from '~/types'
import { io, Socket } from 'socket.io-client'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const seenActionCards = ref<Set<string>>(new Set())
  const activeTurnStartedAt = ref<string | null>(null)
  const currentSessionId = ref<string | null>(null)
  const runtimeMode = ref<string>('native_saas')
  const runtimeProvider = ref<'pro-agent' | 'hermes'>('pro-agent')
  let socket: Socket | null = null
  let pendingSend: { content: string; agentProfileId: string; attachmentIds?: string[]; runtimeMode: string; runtimeProvider: 'pro-agent' | 'hermes' } | null = null

  // ───── Threads ─────
  interface Thread {
    id: string
    title: string | null
    lastMessageAt: string | null
    status: string
    createdAt: string
  }

  const threads = ref<Thread[]>([])
  const threadsLoading = ref(false)

  async function loadThreads (): Promise<void> {
    const workspaceId = await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId) return
    threadsLoading.value = true
    try {
      const sessions = await useApi<any[]>(`/workspaces/${workspaceId}/runtime/chat/sessions`)
      threads.value = (sessions || []).map(s => ({
        id: s.id,
        title: s.title || null,
        lastMessageAt: s.lastMessageAt,
        status: s.status,
        createdAt: s.createdAt,
      }))
    } catch {
      threads.value = []
    } finally {
      threadsLoading.value = false
    }
  }

  async function createThread (agentProfileId: string = 'orchestrator'): Promise<string> {
    const workspaceId = await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId) throw new Error('No workspace selected')

    const session = await useApi<any>(`/workspaces/${workspaceId}/runtime/chat/sessions`, {
      method: 'POST',
      body: { agentProfileId },
    })

    threads.value.unshift({
      id: session.id,
      title: session.title || 'New chat',
      lastMessageAt: session.lastMessageAt,
      status: session.status,
      createdAt: session.createdAt,
    })

    return session.id
  }

  async function switchThread (sessionId: string): Promise<void> {
    const workspaceId = await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId) return

    await loadSession(sessionId)
  }

  async function renameThread (sessionId: string, title: string): Promise<void> {
    const workspaceId = await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId) return

    await useApi(`/workspaces/${workspaceId}/runtime/chat/sessions/${sessionId}`, {
      method: 'PATCH',
      body: { title },
    })

    const t = threads.value.find(x => x.id === sessionId)
    if (t) t.title = title
  }

  async function autoTitleThread (sessionId: string, content: string): Promise<void> {
    const title = content.slice(0, 40).trim()
    if (!title || title.length < 3) return
    await renameThread(sessionId, title || 'New chat')
  }

  // ───── WebSocket lifecycle ─────

  function connectSocket (wsId?: string): Socket | null {
    if (socket?.connected) return socket
    if (socket) {
      socket.disconnect()
      socket = null
    }
    const token = useCookie('access_token').value
    const baseUrl = useRuntimeConfig().public.apiBaseUrl as string
    const wsUrl = baseUrl.replace('/api/v1', '')
    const workspaceId = wsId || useWorkspaceStore().currentWorkspaceId
    if (!token) return null

    socket = io(`${wsUrl}/agent-runtime`, {
      auth: { token: `Bearer ${token}`, workspaceId },
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      console.log('[chat.ws] connected')
      if (pendingSend) {
        const p = pendingSend
        pendingSend = null
        emitChatSend(p.content, p.agentProfileId, p.attachmentIds, p.runtimeMode, p.runtimeProvider)
      }
    })

    socket.on('disconnect', (reason) => {
      console.log('[chat.ws] disconnected', reason)
    })

    socket.on('chat.user_message', (payload: any) => {
      // Message already added optimistically in sendMessage — skip the echo
    })

    socket.on('chat.assistant_delta', (payload: any) => {
      if (payload.sessionId && payload.sessionId !== currentSessionId.value) return
      const streamId = streamMessageId(payload)
      const existing = messages.value.find(message => message.id === streamId)
      if (existing) {
        existing.content += payload.content
        return
      }
      const last = messages.value[messages.value.length - 1]
      if (last && last.role === 'assistant' && last.id === streamId) {
        last.content += payload.content
      } else {
        messages.value.push({
          id: streamId,
          role: 'assistant',
          content: payload.content,
          agentProfileId: payload.agentProfileId,
          timestamp: new Date().toISOString()
        })
      }
    })

    socket.on('chat.assistant_final', (payload: any) => {
      if (payload.sessionId && payload.sessionId !== currentSessionId.value) return
      isLoading.value = false
      if (payload.message) {
        const finalMessage = toChatMessage(payload.message)
        const existingFinalIndex = messages.value.findIndex(message => message.id === finalMessage.id)
        if (existingFinalIndex >= 0) {
          messages.value[existingFinalIndex] = finalMessage
          return
        }
        const streamId = streamMessageId(payload)
        const streamedIndex = messages.value.findIndex(message => message.id === streamId)
        if (streamedIndex >= 0) {
          messages.value[streamedIndex] = finalMessage
          return
        }
        const last = messages.value[messages.value.length - 1]
        if (last && last.role === 'assistant' && isActiveTurnMessage(last)) {
          messages.value[messages.value.length - 1] = finalMessage
        } else {
          messages.value.push(finalMessage)
        }
      }
    })

    socket.on('chat.status', (payload: any) => {
      if (payload.sessionId && payload.sessionId !== currentSessionId.value) return
      messages.value.push({
        id: crypto.randomUUID(),
        role: 'system',
        content: payload.content || payload.status,
        timestamp: new Date().toISOString()
      })
    })

    socket.on('chat.error', (payload: any) => {
      if (payload.sessionId && payload.sessionId !== currentSessionId.value) return
      isLoading.value = false
      messages.value.push({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Error: ${payload.content || payload.message || 'Unknown error'}`,
        timestamp: new Date().toISOString()
      })
    })

    socket.on('chat.action_card', (payload: any) => {
      appendActionCard({
        type: payload.type,
        id: payload.id,
        title: payload.title,
        description: payload.description,
        status: payload.status,
        priority: payload.priority,
        metadata: payload.metadata,
      })
    })

    return socket
  }

  function disconnectSocket (): void {
    if (socket) {
      socket.disconnect()
      socket = null
    }
  }

  function emitChatSend (
    content: string,
    agentProfileId: string,
    attachmentIds?: string[],
    mode: string = runtimeMode.value,
    provider: 'pro-agent' | 'hermes' = runtimeProvider.value,
  ): void {
    if (!currentSessionId.value || !socket?.connected) {
      pendingSend = { content, agentProfileId, attachmentIds, runtimeMode: mode, runtimeProvider: provider }
      return
    }
    socket.emit('chat.send', {
      sessionId: currentSessionId.value,
      content,
      attachmentIds,
      runtimeMode: mode,
      runtimeProvider: provider,
    })
  }

  // ───── Actions ─────

  async function ensureSession (agentProfileId: string): Promise<string> {
    if (currentSessionId.value) return currentSessionId.value

    const workspaceId = await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId) throw new Error('No workspace selected')

    const session = await useApi<any>(`/workspaces/${workspaceId}/runtime/chat/sessions`, {
      method: 'POST',
      body: { agentProfileId },
    })
    currentSessionId.value = session.id
    return session.id
  }

  async function sendMessage (content: string, agentProfileId: string = 'orchestrator', files: File[] = []): Promise<void> {
    const workspaceId = await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId) throw new Error('No workspace selected')

    const uploadedAttachments = files.length ? await useAttachments().uploadFiles(files, { scope: 'chat' }) : []
    const attachmentIds = uploadedAttachments.map(a => a.id)

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

    connectSocket(workspaceId)

    try {
      if (!currentSessionId.value) {
        currentSessionId.value = await createThread(agentProfileId)
      }
      emitChatSend(content, agentProfileId, attachmentIds)

      // Auto-title from first user message
      const t = threads.value.find(x => x.id === currentSessionId.value)
      if (t && (!t.title || t.title === 'New chat')) {
        await autoTitleThread(currentSessionId.value, content)
      }
    } catch (e: any) {
      isLoading.value = false
      error.value = e.message || 'Failed to create session'
    }

    // Fallback: if not connected after 500ms, show error
    if (!socket?.connected) {
      setTimeout(() => {
        if (isLoading.value && !socket?.connected) {
          error.value = 'Connection lost. Trying to reconnect...'
        }
      }, 500)
    }
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

  function streamMessageId (payload: any): string {
    return `stream:${payload.jobId || payload.runId || payload.sessionId || currentSessionId.value || 'current'}`
  }

  function isActiveTurnMessage (message: ChatMessage): boolean {
    if (!activeTurnStartedAt.value || !message.timestamp) return false
    return new Date(message.timestamp).getTime() >= new Date(activeTurnStartedAt.value).getTime()
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

  function clearMessages (): void {
    disconnectSocket()
    messages.value = []
    seenActionCards.value = new Set()
    runtimeMode.value = 'native_saas'
    runtimeProvider.value = 'pro-agent'
  }

  async function startNewThread (agentProfileId: string = 'orchestrator'): Promise<void> {
    disconnectSocket()
    messages.value = []
    seenActionCards.value = new Set()
    runtimeMode.value = 'native_saas'
    runtimeProvider.value = 'pro-agent'
    currentSessionId.value = await createThread(agentProfileId)
  }

  async function loadSession (sessionId: string, opts?: { updateThreadState?: boolean }): Promise<void> {
    const workspaceId = await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId) return

    try {
      const msgs = await useApi<any[]>(`/workspaces/${workspaceId}/runtime/chat/sessions/${sessionId}/messages`)
      messages.value = (msgs || []).map(m => toChatMessage(m))
      currentSessionId.value = sessionId
      isLoading.value = false

      if (opts?.updateThreadState !== false) {
        const t = threads.value.find(x => x.id === sessionId)
        if (t) t.status = 'active'
      }
    } catch {
      messages.value = []
      isLoading.value = false
    }
  }

  async function listSessions (): Promise<any[]> {
    await loadThreads()
    return threads.value
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
    currentSessionId,
    runtimeMode,
    runtimeProvider,
    threads,
    threadsLoading,
    sendMessage,
    clearMessages,
    startNewThread,
    addSystemMessage,
    loadSession,
    listSessions,
    connectSocket,
    disconnectSocket,
    loadThreads,
    createThread,
    switchThread,
    renameThread,
    autoTitleThread,
  }
})
