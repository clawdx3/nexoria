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
    // Backend sets httpOnly cookie; we keep a js-readable flag for UI checks
    useCookie('nx_auth', { sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 }).value = '1'
    user.value = res.user
  }

  async function register (payload: RegisterPayload): Promise<void> {
    const res = await useApi<AuthResponse>('/auth/register', {
      method: 'POST',
      body: payload
    })
    useCookie('nx_auth', { sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 }).value = '1'
    user.value = res.user
  }

  function logout (): void {
    useCookie('nx_auth').value = null
    user.value = null
    navigateTo('/login')
  }

  async function tryFetchUser (): Promise<void> {
    try {
      // If backend adds /users/me or /auth/me in future
      const res = await useApi<{ user: User }>('/users/me')
      user.value = res.user
    } catch {
      user.value = null
    }
  }

  return { user, isAuthenticated, login, register, logout, tryFetchUser }
})
