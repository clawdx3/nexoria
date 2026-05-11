export function useApprovals () {
  const approvals = ref<any[]>([])
  const isLoading = ref(false)
  const pendingApprovals = computed(() => approvals.value.filter(approval => approval.status === 'pending'))

  const { connect, onApprovalUpdate, startPolling, stopPolling } = useRealtime()

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

  function setupRealtime (): void {
    const auth = useAuthStore()
    if (!auth.token) return
    connect(auth.token)
    onApprovalUpdate((data: any) => {
      // Merge incoming approval update into local state
      const idx = approvals.value.findIndex((a: any) => a.id === data.id)
      if (idx >= 0) {
        approvals.value[idx] = { ...approvals.value[idx], ...data }
      } else {
        approvals.value.unshift(data)
      }
    })
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

  return { approvals, pendingApprovals, isLoading, fetchApprovals, approve, reject, setupRealtime }
}
