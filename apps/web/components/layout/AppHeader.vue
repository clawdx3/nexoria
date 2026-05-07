<template>
  <header class="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 dark:border-slate-800 dark:bg-slate-950">
    <div class="flex min-w-0 flex-1 items-center gap-4">
      <LayoutWorkspaceSwitcher />
      <div class="hidden h-9 max-w-xl flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 lg:flex">
        <Search class="h-4 w-4 shrink-0" />
        <span class="truncate">Search tasks, approvals, agents, memory...</span>
        <kbd class="ml-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-950">⌘K</kbd>
      </div>
    </div>
    <div class="flex items-center gap-4">
      <UButton color="cyan" size="sm" class="hidden gap-2 md:inline-flex" @click="navigateTo('/')">
        <Play class="h-4 w-4" />
        Run Agent
      </UButton>
      <UButton
        variant="ghost"
        color="gray"
        square
        aria-label="Toggle theme"
        @click="toggleColorMode"
      >
        <component :is="isDark ? Sun : Moon" class="h-4 w-4" />
      </UButton>
      <UDropdown :items="userMenuItems">
        <UButton variant="ghost" color="gray" class="gap-2">
          <UAvatar
            :src="user?.avatarUrl || undefined"
            :alt="fallbackName"
            size="sm"
          />
          <span class="hidden text-sm font-medium md:inline">{{ displayName }}</span>
        </UButton>
      </UDropdown>
    </div>
  </header>
</template>

<script setup lang="ts">
import { Sun, Moon, Search, Play } from 'lucide-vue-next'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
function toggleColorMode () {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

const { user, logout } = useAuth()
const displayName = computed(() => {
  if (!user.value) return ''
  return `${user.value.firstName} ${user.value.lastName}`.trim()
})
const fallbackName = computed(() => {
  if (!user.value) return 'U'
  return `${user.value.firstName[0]}${user.value.lastName[0]}`.toUpperCase()
})

const userMenuItems = [
  [{
    label: 'Settings',
    click: () => navigateTo('/settings/profile')
  }],
  [{
    label: 'Logout',
    click: () => logout()
  }]
]
</script>
