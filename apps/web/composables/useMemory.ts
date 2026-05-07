import type { MemoryEntry } from '~/types'

export function useMemory () {
  const memories = ref<MemoryEntry[]>([])
  const isLoading = ref(false)

  async function fetchMemories (): Promise<void> {
    isLoading.value = true
    try {
      const ws = await useWorkspaceStore().ensureWorkspace()
      if (!ws) {
        memories.value = []
        return
      }
      const res = await useApi<MemoryEntry[]>(`/workspaces/${ws}/memory`)
      memories.value = res || []
    } finally {
      isLoading.value = false
    }
  }

  async function reviewMemory (id: string, action: 'approve' | 'reject' | 'edit', content?: string): Promise<void> {
    const ws = await useWorkspaceStore().ensureWorkspace()
    if (!ws) return
    await useApi(`/workspaces/${ws}/memory/${id}/review`, {
      method: 'POST',
      body: { action, content }
    })
    await fetchMemories()
  }

  return { memories, isLoading, fetchMemories, reviewMemory }
}
