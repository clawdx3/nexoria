export function useApprovals () {
  const approvals = ref<any[]>([])
  const isLoading = ref(false)

  async function fetchApprovals (): Promise<void> {
    const ws = await useWorkspaceStore().ensureWorkspace()
    if (!ws) return
    isLoading.value = true
    try {
      const res = await useApi<any[]>(`/workspaces/${ws}/approvals`)
      approvals.value = res || []
    } finally {
      isLoading.value = false
    }
  }

  async function approve (id: string, decision?: string): Promise<void> {
    const ws = await useWorkspaceStore().ensureWorkspace()
    if (!ws) return
    await useApi(`/workspaces/${ws}/approvals/${id}/decisions`, {
      method: 'POST',
      body: { outcome: 'approve', reason: decision }
    })
    await fetchApprovals()
  }

  async function reject (id: string, reason?: string): Promise<void> {
    const ws = await useWorkspaceStore().ensureWorkspace()
    if (!ws) return
    await useApi(`/workspaces/${ws}/approvals/${id}/decisions`, {
      method: 'POST',
      body: { outcome: 'reject', reason }
    })
    await fetchApprovals()
  }

  return { approvals, isLoading, fetchApprovals, approve, reject }
}
