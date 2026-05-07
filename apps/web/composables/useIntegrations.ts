import type { Integration } from '~/types'

export function useIntegrations () {
  const integrations = ref<Integration[]>([])
  const isLoading = ref(false)

  async function fetchIntegrations (): Promise<void> {
    isLoading.value = true
    const res = await useApi<{ integrations: Integration[] }>('/integrations')
    integrations.value = res.integrations || []
    isLoading.value = false
  }

  async function connect (type: string, payload: Record<string, any>): Promise<Integration> {
    const res = await useApi<{ integration: Integration }>('/integrations', {
      method: 'POST',
      body: { type, ...payload }
    })
    integrations.value.push(res.integration)
    return res.integration
  }

  return { integrations, isLoading, fetchIntegrations, connect }
}
