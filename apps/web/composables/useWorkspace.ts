export function useWorkspace () {
  const store = useWorkspaceStore()
  return {
    workspaces: computed(() => store.workspaces),
    currentWorkspace: computed(() => store.currentWorkspace),
    currentWorkspaceId: computed(() => store.currentWorkspaceId),
    fetchWorkspaces: store.fetchWorkspaces,
    createWorkspace: store.createWorkspace,
    switchWorkspace: store.switchWorkspace
  }
}
