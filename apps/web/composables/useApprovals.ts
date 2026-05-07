import type { Approval, ApprovalDecision } from '~/types'

export function useApprovals () {
  const approvals = ref<Approval[]>([])
  const isLoading = ref(false)

  async function fetchApprovals (): Promise<void> {
    isLoading.value = true
    const res = await useApi<{ approvals: Approval[] }>('/api/approvals')
    approvals.value = res.approvals || []
    isLoading.value = false
  }

  async function submitDecision (id: string, outcome: string, reason?: string): Promise<Approval> {
    const res = await useApi<{ approval: Approval }>(`/api/approvals/${id}/decide`, {
      method: 'POST',
      body: { outcome, reason }
    })
    const idx = approvals.value.findIndex(a => a.id === id)
    if (idx !== -1) approvals.value[idx] = res.approval
    return res.approval
  }

  const pendingApprovals = computed(() => approvals.value.filter(a => a.status === 'pending'))

  return { approvals, pendingApprovals, isLoading, fetchApprovals, submitDecision }
}
