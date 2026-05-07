export function useAuth () {
  const store = useAuthStore()
  return {
    user: computed(() => store.user),
    isAuthenticated: computed(() => store.isAuthenticated),
    login: store.login,
    register: store.register,
    logout: store.logout,
    fetchMe: store.fetchMe
  }
}
