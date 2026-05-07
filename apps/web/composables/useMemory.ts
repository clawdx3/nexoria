import type { MemoryEntry } from '~/types'

export function useMemory () {
  const memories = ref<MemoryEntry[]>([])
  const isLoading = ref(false)

  async function fetchMemories (): Promise<void> {
    isLoading.value = true
    const res = await useApi<{ memories: MemoryEntry[] }>('/api/memory')
    memories.value = res.memories || []
    isLoading.value = false
  }

  async function reviewMemory (id: string, action: 'approve' | 'reject' | 'edit', content?: string): Promise<void> {
    await useApi(`/api/memory/${id}/review`, {
      method: 'POST',
      body: { action, content }
    })
    await fetchMemories()
  }

  return { memories, isLoading, fetchMemories, reviewMemory }
}
