import { defineStore } from 'pinia'
import type { User, AuthResponse, LoginPayload, RegisterPayload } from '~/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => !!user.value)

  async function login (payload: LoginPayload): Promise<void> {
    const res = await useApi<AuthResponse>('/auth/login', {
      method: 'POST',
      body: payload
    })
    useCookie('access_token', { sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 }).value = res.accessToken
    useCookie('nx_auth').value = null
    user.value = res.user
  }

  async function register (payload: RegisterPayload): Promise<void> {
    await useApi('/auth/register', {
      method: 'POST',
      body: payload
    })
    await login({ email: payload.email, password: payload.password })
  }

  function logout (): void {
    useCookie('nx_auth').value = null
    useCookie('access_token').value = null
    user.value = null
    navigateTo('/login')
  }

  async function tryFetchUser (): Promise<void> {
    try {
      user.value = await useApi<User>('/auth/me')
    } catch {
      user.value = null
    }
  }

  return { user, isAuthenticated, login, register, logout, tryFetchUser }
})
