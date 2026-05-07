import type { NitroFetchOptions, NitroFetchRequest } from 'nitropack'

function apiBase (): string {
  return useRuntimeConfig().public.apiBaseUrl as string
}

function getHeaders (): Record<string, string> {
  const token = useCookie('access_token').value
  const workspace = useCookie('workspace_id').value
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (workspace) headers['x-workspace-id'] = workspace
  return headers
}

export async function useApi<T> (
  endpoint: string,
  opts?: NitroFetchOptions<NitroFetchRequest>
): Promise<T> {
  const url = `${apiBase()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  const options: NitroFetchOptions<NitroFetchRequest> = {
    ...opts,
    headers: {
      ...getHeaders(),
      ...(opts?.headers || {})
    } as any
  }
  try {
    return await $fetch<T>(url, options)
  } catch (err: any) {
    if (err?.response?.status === 401) {
      navigateTo('/login')
    }
    throw err
  }
}
