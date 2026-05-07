export function useAuth () {
  const store = useAuthStore()

  async function login (payload: { email: string, password: string }): Promise<void> {
    const res = await useApi<{ accessToken: string, user: any }>('/auth/login', {
      method: 'POST',
      body: payload
    })
    useCookie('access_token', { sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 }).value = res.accessToken
    store.user.value = res.user
    store.isAuthenticated.value = true
  }

  async function register (payload: { email: string, password: string, firstName: string, lastName: string }): Promise<void> {
    const res = await useApi<{ accessToken: string, user: any }>('/auth/register', {
      method: 'POST',
      body: payload
    })
    useCookie('access_token', { sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 }).value = res.accessToken
    store.user.value = res.user
    store.isAuthenticated.value = true
  }

  function logout (): void {
    useCookie('access_token').value = null
    store.user.value = null
    store.isAuthenticated.value = false
    navigateTo('/login')
  }

  async function fetchMe (): Promise<void> {
    try {
      store.user.value = await useApi<any>('/auth/me')
      store.isAuthenticated.value = true
    } catch {
      store.user.value = null
      store.isAuthenticated.value = false
    }
  }

  return {
    user: computed(() => store.user.value),
    isAuthenticated: computed(() => store.isAuthenticated.value),
    login,
    register,
    logout,
    fetchMe
  }
}
