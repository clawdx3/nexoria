export function useApprovals () {
  const approvals = ref<any[]>([])
  const isLoading = ref(false)

  async function fetchApprovals (): Promise<void> {
    const ws = useCookie('workspace_id').value
    if (!ws) return
    isLoading.value = true
    try {
      const res = await useApi<{ approvals: any[] }>(`/workspaces/${ws}/approvals`)
      approvals.value = res.approvals || []
    } finally {
      isLoading.value = false
    }
  }

  async function approve (id: string, decision?: string): Promise<void> {
    const ws = useCookie('workspace_id').value
    if (!ws) return
    await useApi(`/workspaces/${ws}/approvals/${id}/approve`, {
      method: 'POST',
      body: { decision }
    })
    await fetchApprovals()
  }

  async function reject (id: string, reason?: string): Promise<void> {
    const ws = useCookie('workspace_id').value
    if (!ws) return
    await useApi(`/workspaces/${ws}/approvals/${id}/reject`, {
      method: 'POST',
      body: { reason }
    })
    await fetchApprovals()
  }

  return { approvals, isLoading, fetchApprovals, approve, reject }
}
