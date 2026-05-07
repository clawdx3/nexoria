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
    switchWorkspace
  }
})
