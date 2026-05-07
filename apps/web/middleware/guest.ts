export default defineNuxtRouteMiddleware(async () => {
  const cookie = useCookie('nx_auth').value
  if (cookie) {
    return navigateTo('/')
  }
})
