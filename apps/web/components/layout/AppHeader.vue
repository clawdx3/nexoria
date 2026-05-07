<template>
  <header class="flex h-16 items-center justify-between border-b border-slate-200 px-6 dark:border-slate-800">
    <div class="flex items-center gap-4">
      <WorkspaceSwitcher />
    </div>
    <div class="flex items-center gap-4">
      <UButton
        variant="ghost"
        color="gray"
        square
        :icon="isDark ? Sun : Moon"
        aria-label="Toggle theme"
        @click="toggleColorMode"
      />
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
import { Sun, Moon, Settings, LogOut } from 'lucide-vue-next'

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
    icon: Settings,
    click: () => navigateTo('/settings/profile')
  }],
  [{
    label: 'Logout',
    icon: LogOut,
    click: () => logout()
  }]
]
</script>
