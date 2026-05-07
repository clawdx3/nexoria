export function useWorkspace () {
  const store = useWorkspaceStore()
  const members = ref<any[]>([])

  async function fetchMembers (): Promise<void> {
    const workspaceId = store.currentWorkspaceId || useCookie('workspace_id').value
    if (!workspaceId) {
      members.value = []
      return
    }
    members.value = await useApi<any[]>(`/workspaces/${workspaceId}/members`)
  }

  return {
    workspaces: computed(() => store.workspaces),
    currentWorkspace: computed(() => store.currentWorkspace),
    currentWorkspaceId: computed(() => store.currentWorkspaceId),
    members,
    fetchMembers,
    fetchWorkspaces: store.fetchWorkspaces,
    createWorkspace: store.createWorkspace,
    switchWorkspace: store.switchWorkspace,
    ensureWorkspace: store.ensureWorkspace
  }
}
