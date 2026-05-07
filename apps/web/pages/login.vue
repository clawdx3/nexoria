<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
    <div class="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div class="text-center">
        <img src="/logo.svg" alt="Nexoria" class="mx-auto mb-4 h-10 w-10" />
        <h1 class="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p class="mt-2 text-sm text-slate-500">Sign in to your Nexoria workspace</p>
      </div>

      <UForm :state="state" class="space-y-4" @submit="onSubmit">
        <UFormGroup label="Email" name="email">
          <UInput v-model="state.email" type="email" placeholder="you@company.com" />
        </UFormGroup>
        <UFormGroup label="Password" name="password">
          <UInput v-model="state.password" type="password" placeholder="••••••••" />
        </UFormGroup>
        <UButton type="submit" color="indigo" block :loading="isLoading">
          Sign in
        </UButton>
      </UForm>

      <p class="text-center text-sm text-slate-500">
        Don't have an account?
        <NuxtLink to="/register" class="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Create one
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'guest' })

const { login } = useAuth()
const isLoading = ref(false)
const state = reactive({ email: '', password: '' })
const toast = useToast()

async function onSubmit () {
  isLoading.value = true
  try {
    await login(state)
    navigateTo('/')
  } catch (err: any) {
    toast.add({ title: 'Login failed', description: err?.data?.message || 'Invalid credentials', color: 'red' })
  } finally {
    isLoading.value = false
  }
}
</script>
