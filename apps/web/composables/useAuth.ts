export function useAuth () {
  const store = useAuthStore()

  function setSession (accessToken: string, user: any): void {
    useCookie('access_token', { sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 }).value = accessToken
    useCookie('nx_auth').value = null
    store.user = user
  }

  async function login (payload: { email: string, password: string }): Promise<void> {
    const res = await useApi<{ accessToken: string, user: any }>('/auth/login', {
      method: 'POST',
      body: payload
    })
    setSession(res.accessToken, res.user)
  }

  async function register (payload: { email: string, password: string, firstName: string, lastName: string }): Promise<void> {
    await useApi('/auth/register', {
      method: 'POST',
      body: payload
    })
    await login({ email: payload.email, password: payload.password })
  }

  function logout (): void {
    useCookie('access_token').value = null
    useCookie('nx_auth').value = null
    store.user = null
    navigateTo('/login')
  }

  async function fetchMe (): Promise<void> {
    try {
      store.user = await useApi<any>('/auth/me')
    } catch {
      useCookie('access_token').value = null
      store.user = null
    }
  }

  return {
    user: computed(() => store.user),
    isAuthenticated: computed(() => store.isAuthenticated),
    login,
    register,
    logout,
    fetchMe
  }
}
