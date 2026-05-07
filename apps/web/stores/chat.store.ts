import { defineStore } from 'pinia'
import type { ChatMessage } from '~/types'

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const isLoading = ref(false)

  function addMessage (msg: ChatMessage): void {
    messages.value.push(msg)
  }

  function setLoading (v: boolean): void {
    isLoading.value = v
  }

  function clear (): void {
    messages.value = []
  }

  async function sendMessage (content: string, agentProfileId?: string, workspaceId?: string): Promise<void> {
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      role: 'user',
      content,
      agentProfileId: agentProfileId || null,
      timestamp: new Date().toISOString()
    }
    addMessage(userMsg)
    setLoading(true)
    try {
      const endpoint = agentProfileId
        ? `/agent-runtime/run/${agentProfileId}`
        : '/agent-runtime/run/orchestrator'
      const res = await useApi<{ result: { finalOutput: string } }>(endpoint, {
        method: 'POST',
        body: { message: content }
      })
      const reply: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        role: 'assistant',
        content: res.result?.finalOutput || 'Done.',
        agentProfileId: agentProfileId || null,
        timestamp: new Date().toISOString()
      }
      addMessage(reply)
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        role: 'assistant',
        content: `Error: ${err?.data?.message || err.message || 'Something went wrong'}`,
        agentProfileId: null,
        timestamp: new Date().toISOString()
      }
      addMessage(errMsg)
    } finally {
      setLoading(false)
    }
  }

  return { messages, isLoading, addMessage, setLoading, clear, sendMessage }
})
