export function useManagedRuntime () {
  const status = ref<any | null>(null)
  const jobs = ref<any[]>([])
  const artifacts = ref<any[]>([])
  const isLoading = ref(false)

  async function fetchRuntime (): Promise<void> {
    const ws = await useWorkspaceStore().ensureWorkspace()
    if (!ws) return
    isLoading.value = true
    try {
      const [runtimeStatus, runtimeJobs, runtimeArtifacts] = await Promise.all([
        useApi<any>(`/workspaces/${ws}/runtime/status`),
        useApi<any[]>(`/workspaces/${ws}/runtime/jobs`),
        useApi<any[]>(`/workspaces/${ws}/artifacts`)
      ])
      status.value = runtimeStatus
      jobs.value = runtimeJobs || []
      artifacts.value = runtimeArtifacts || []
    } finally {
      isLoading.value = false
    }
  }

  async function createJob (payload: { agentProfileId: string; type?: string; input: Record<string, any>; limits?: Record<string, any> }): Promise<any> {
    const ws = await useWorkspaceStore().ensureWorkspace()
    if (!ws) throw new Error('No workspace selected')
    const job = await useApi<any>(`/workspaces/${ws}/runtime/jobs`, {
      method: 'POST',
      body: payload
    })
    jobs.value.unshift(job)
    return job
  }

  function artifactUrl (artifact: any): string {
    const base = useRuntimeConfig().public.apiBaseUrl as string
    return `${base}/workspaces/${artifact.workspaceId}/artifacts/${artifact.id}/download`
  }

  return {
    status,
    jobs,
    artifacts,
    isLoading,
    fetchRuntime,
    createJob,
    artifactUrl
  }
}
