<template>
  <div class="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
    <div class="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div class="text-center">
        <img src="/logo.svg" alt="Nexoria" class="mx-auto mb-4 h-10 w-10" />
        <h1 class="text-2xl font-bold tracking-tight">Create your account</h1>
        <p class="mt-2 text-sm text-slate-500">Start building your AI team</p>
      </div>

      <UForm :state="state" class="space-y-4" @submit="onSubmit">
        <div class="grid grid-cols-2 gap-4">
          <UFormGroup label="First name" name="firstName">
            <UInput v-model="state.firstName" placeholder="Jane" />
          </UFormGroup>
          <UFormGroup label="Last name" name="lastName">
            <UInput v-model="state.lastName" placeholder="Doe" />
          </UFormGroup>
        </div>
        <UFormGroup label="Email" name="email">
          <UInput v-model="state.email" type="email" placeholder="you@company.com" />
        </UFormGroup>
        <UFormGroup label="Password" name="password">
          <UInput v-model="state.password" type="password" placeholder="••••••••" />
        </UFormGroup>
        <UButton type="submit" color="indigo" block :loading="isLoading">
          Create account
        </UButton>
      </UForm>

      <p class="text-center text-sm text-slate-500">
        Already have an account?
        <NuxtLink to="/login" class="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          Sign in
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'guest' })

const { register } = useAuth()
const isLoading = ref(false)
const state = reactive({ firstName: '', lastName: '', email: '', password: '' })
const toast = useToast()

async function onSubmit () {
  isLoading.value = true
  try {
    await register(state)
    navigateTo('/')
  } catch (err: any) {
    toast.add({ title: 'Registration failed', description: err?.data?.message || 'Something went wrong', color: 'red' })
  } finally {
    isLoading.value = false
  }
}
</script>
