import type { AgentProfile } from '~/types'

export function useAgent () {
  const agents = ref<AgentProfile[]>([])
  const isLoading = ref(false)

  async function fetchAgents (): Promise<void> {
    isLoading.value = true
    const res = await useApi<{ agentProfiles: AgentProfile[] }>('/api/agent-profiles')
    agents.value = res.agentProfiles || []
    isLoading.value = false
  }

  async function createAgent (payload: Partial<AgentProfile>): Promise<AgentProfile> {
    const res = await useApi<{ agentProfile: AgentProfile }>('/api/agent-profiles', {
      method: 'POST',
      body: payload
    })
    agents.value.push(res.agentProfile)
    return res.agentProfile
  }

  async function updateAgent (id: string, payload: Partial<AgentProfile>): Promise<AgentProfile> {
    const res = await useApi<{ agentProfile: AgentProfile }>(`/api/agent-profiles/${id}`, {
      method: 'PATCH',
      body: payload
    })
    const idx = agents.value.findIndex(a => a.id === id)
    if (idx !== -1) agents.value[idx] = res.agentProfile
    return res.agentProfile
  }

  async function deleteAgent (id: string): Promise<void> {
    await useApi(`/api/agent-profiles/${id}`, { method: 'DELETE' })
    agents.value = agents.value.filter(a => a.id !== id)
  }

  return { agents, isLoading, fetchAgents, createAgent, updateAgent, deleteAgent }
}
