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

  return { messages, isLoading, addMessage, setLoading, clear }
})
