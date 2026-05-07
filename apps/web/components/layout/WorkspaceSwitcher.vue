<template>
  <UDropdown :items="workspaceItems">
    <UButton variant="ghost" color="gray" class="gap-2">
      <Building2 class="h-5 w-5 text-slate-500" />
      <span class="hidden max-w-[120px] truncate text-sm font-medium md:inline">
        {{ currentWorkspace?.name || 'Select workspace' }}
      </span>
      <ChevronsUpDown class="h-4 w-4 text-slate-400" />
    </UButton>
  </UDropdown>
</template>

<script setup lang="ts">
import { Building2, ChevronsUpDown } from 'lucide-vue-next'

const { workspaces, currentWorkspace, fetchWorkspaces, switchWorkspace } = useWorkspace()

onMounted(() => { void fetchWorkspaces() })

const workspaceItems = computed(() =>
  workspaces.value.map(w => ({
    label: w.name,
    click: () => switchWorkspace(w.id)
  }))
)
</script>
