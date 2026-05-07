<template>
  <UDropdown :items="workspaceItems">
    <UButton variant="ghost" color="gray" class="h-9 gap-2 rounded-lg px-2">
      <span class="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
        <Building2 class="h-4 w-4" />
      </span>
      <span class="hidden min-w-0 md:block">
        <span class="block max-w-[160px] truncate text-sm font-semibold leading-4">
          {{ currentWorkspace?.name || 'Acme Consulting' }}
        </span>
        <span class="block text-left text-[11px] leading-3 text-slate-500">Workspace</span>
      </span>
      <ChevronsUpDown class="h-4 w-4 text-slate-400" />
    </UButton>
  </UDropdown>
</template>

<script setup lang="ts">
import { Building2, ChevronsUpDown } from 'lucide-vue-next'

const { workspaces, currentWorkspace, switchWorkspace } = useWorkspace()

const workspaceItems = computed(() =>
  workspaces.value.map(w => ({
    label: w.name,
    click: () => switchWorkspace(w.id)
  }))
)
</script>
