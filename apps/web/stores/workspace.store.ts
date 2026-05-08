import { defineStore } from 'pinia'
import type { Workspace } from '~/types'

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaces = ref<Workspace[]>([])
  const currentWorkspaceId = ref<string | null>(useCookie('workspace_id').value ?? null)
  const isLoading = ref(false)
  let fetchPromise: Promise<void> | null = null

  const currentWorkspace = computed(() =>
    workspaces.value.find(w => w.id === currentWorkspaceId.value) || null
  )

  async function fetchWorkspaces (): Promise<void> {
    if (fetchPromise) return fetchPromise
    fetchPromise = (async () => {
      isLoading.value = true
      try {
        const res = await useApi<Workspace[]>('/workspaces')
        workspaces.value = res || []
        const storedId = useCookie('workspace_id').value
        const storedExists = storedId && workspaces.value.some(w => w.id === storedId)
        if (storedExists) {
          setWorkspace(storedId)
        } else if (workspaces.value.length) {
          setWorkspace(workspaces.value[0].id)
        } else {
          const workspace = await createDefaultWorkspace()
          workspaces.value = [workspace]
          setWorkspace(workspace.id)
        }
      } finally {
        isLoading.value = false
        fetchPromise = null
      }
    })()
    return fetchPromise
  }

  async function createWorkspace (payload: { name: string; description?: string }): Promise<Workspace> {
    const res = await useApi<Workspace>('/workspaces', {
      method: 'POST',
      body: payload
    })
    workspaces.value.push(res)
    setWorkspace(res.id)
    return res
  }

  async function createDefaultWorkspace (): Promise<Workspace> {
    return useApi<Workspace>('/workspaces', {
      method: 'POST',
      body: {
        name: 'My Workspace',
        description: 'Default workspace'
      }
    })
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
    setWorkspace(id)
    window.location.reload()
  }

  function setWorkspace (id: string | null): void {
    currentWorkspaceId.value = id
    useCookie('workspace_id').value = id
  }

  async function ensureWorkspace (): Promise<string | null> {
    const cookieId = useCookie('workspace_id').value
    if (!currentWorkspaceId.value && cookieId) {
      currentWorkspaceId.value = cookieId
    }

    if (!workspaces.value.length) {
      await fetchWorkspaces()
    }

    if (
      currentWorkspaceId.value &&
      workspaces.value.some(workspace => workspace.id === currentWorkspaceId.value)
    ) {
      return currentWorkspaceId.value
    }

    if (workspaces.value.length) {
      setWorkspace(workspaces.value[0].id)
      return currentWorkspaceId.value
    }

    const workspace = await createDefaultWorkspace()
    workspaces.value = [workspace]
    setWorkspace(workspace.id)
    return currentWorkspaceId.value
  }

  return {
    workspaces,
    currentWorkspaceId,
    currentWorkspace,
    isLoading,
    fetchWorkspaces,
    createWorkspace,
    updateWorkspace,
    switchWorkspace,
    setWorkspace,
    ensureWorkspace
  }
})
