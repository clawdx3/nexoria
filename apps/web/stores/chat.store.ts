import { defineStore } from 'pinia'
import type { ChatMessage } from '~/types'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function sendMessage (content: string, agentProfileId: string = 'orchestrator'): Promise<void> {
    const workspaceId = await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId) throw new Error('No workspace selected')

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    }
    messages.value.push(userMsg)
    isLoading.value = true
    error.value = null

    try {
      const res = await useApi<{ message: string; task?: any; status: string }>(
        `/workspaces/${workspaceId}/agent-runtime/run/${agentProfileId}`,
        {
          method: 'POST',
          body: { message: content }
        }
      )

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.message || 'Task dispatched.',
        agentProfileId,
        timestamp: new Date().toISOString()
      }
      messages.value.push(assistantMsg)
      await useTasksStore().fetchTasks(workspaceId)
    } catch (e: any) {
      error.value = e?.message || 'Failed to get response'
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

  function clearMessages (): void {
    messages.value = []
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
    sendMessage,
    clearMessages,
    addSystemMessage
  }
})
