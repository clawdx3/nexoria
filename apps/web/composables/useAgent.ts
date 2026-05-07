export function useAgent () {
  const agents = ref<any[]>([])
  const currentAgent = ref<any | null>(null)
  const isLoading = ref(false)

  async function fetchAgents (): Promise<void> {
    isLoading.value = true
    try {
      const ws = useCookie('workspace_id').value
      if (!ws) return
      const res = await useApi<any[]>(`/workspaces/${ws}/agent-profiles`)
      agents.value = res || []
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAgent (id: string): Promise<void> {
    const ws = useCookie('workspace_id').value
    if (!ws) return
    currentAgent.value = await useApi<any>(`/workspaces/${ws}/agent-profiles/${id}`)
  }

  async function createAgent (payload: any): Promise<any> {
    const ws = useCookie('workspace_id').value
    if (!ws) throw new Error('No workspace selected')
    const res = await useApi<any>(`/workspaces/${ws}/agent-profiles`, {
      method: 'POST',
      body: payload
    })
    agents.value.push(res)
    return res
  }

  async function updateAgent (id: string, payload: any): Promise<any> {
    const ws = useCookie('workspace_id').value
    if (!ws) throw new Error('No workspace selected')
    const res = await useApi<any>(`/workspaces/${ws}/agent-profiles/${id}`, {
      method: 'PATCH',
      body: payload
    })
    const idx = agents.value.findIndex((a: any) => a.id === id)
    if (idx !== -1) agents.value[idx] = res
    return res
  }

  async function deleteAgent (id: string): Promise<void> {
    const ws = useCookie('workspace_id').value
    if (!ws) throw new Error('No workspace selected')
    await useApi(`/workspaces/${ws}/agent-profiles/${id}`, { method: 'DELETE' })
    agents.value = agents.value.filter((a: any) => a.id !== id)
  }

  return { agents, currentAgent, isLoading, fetchAgents, fetchAgent, createAgent, updateAgent, deleteAgent }
}
