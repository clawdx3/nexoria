<template>
  <div class="flex h-screen w-full overflow-hidden bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
    <LayoutAppSidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <LayoutAppHeader />
      <main class="flex-1 overflow-auto">
        <div v-if="isLoading" class="grid h-full place-items-center">
          <CommonLoadingSpinner />
        </div>
        <slot v-else />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const workspaceStore = useWorkspaceStore()
const isLoading = computed(() => workspaceStore.isLoading)

onMounted(() => {
  void workspaceStore.fetchWorkspaces()
})
</script>
