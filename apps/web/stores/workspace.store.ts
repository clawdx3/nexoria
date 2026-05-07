import { defineStore } from 'pinia'
import type { Workspace } from '~/types'

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaces = ref<Workspace[]>([])
  const currentWorkspaceId = ref<string | null>(useCookie('workspace_id').value ?? null)

  const currentWorkspace = computed(() =>
    workspaces.value.find(w => w.id === currentWorkspaceId.value) || null
  )

  async function fetchWorkspaces (): Promise<void> {
    const res = await useApi<Workspace[]>('/workspaces')
    workspaces.value = res || []
    if (!currentWorkspaceId.value && workspaces.value.length) {
      switchWorkspace(workspaces.value[0].id)
    }
  }

  async function createWorkspace (payload: { name: string; description?: string }): Promise<Workspace> {
    const res = await useApi<Workspace>('/workspaces', {
      method: 'POST',
      body: payload
    })
    workspaces.value.push(res)
    switchWorkspace(res.id)
    return res
  }

  async function updateWorkspace (id: string, payload: Partial<Workspace>): Promise<Workspace> {
    const res = await useApi<Workspace>(`/workspaces/${id}`, {
      method: 'PATCH',
      body: payload
    })
    const idx = workspaces.value.findIndex(w => w.id === id)
    if (idx !== -1) {
      workspaces.value[idx] = { ...workspaces.value[idx], ...res }
    }
    return res
  }

  function switchWorkspace (id: string): void {
    currentWorkspaceId.value = id
    useCookie('workspace_id').value = id
    window.location.reload()
  }

  return {
    workspaces,
    currentWorkspaceId,
    currentWorkspace,
    fetchWorkspaces,
    createWorkspace,
    updateWorkspace,
    switchWorkspace
  }
})
