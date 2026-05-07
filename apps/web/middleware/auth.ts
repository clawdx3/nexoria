export default defineNuxtRouteMiddleware(async () => {
  const token = useCookie('access_token').value
  if (!token) {
    return navigateTo('/login')
  }
})
