<template>
  <div class="app-shell">
    <LayoutAppSidebar @cmd-k="paletteOpen = true" />
    <div class="nx-main-col">
      <LayoutAppTopbar
        :title="pageTitle"
        :subtitle="pageSubtitle"
        :theme="colorMode.value"
        :notif-count="notifCount"
        @theme="toggleTheme"
        @notif="notifOpen = !notifOpen"
        @cmd-k="paletteOpen = true"
      />
      <main style="flex:1;overflow:auto;">
        <slot />
      </main>
    </div>

    <!-- Overlays -->
    <LayoutNotificationsPanel :open="notifOpen" @close="notifOpen = false" />
    <LayoutCommandPalette :open="paletteOpen" @close="paletteOpen = false" @nav="onNav" />
    <LayoutOnboardingFlow :open="onboardingOpen" @close="onboardingOpen = false" />
  </div>
</template>

<script setup lang="ts">
const colorMode = useColorMode()
const route = useRoute()
const workspaceStore = useWorkspaceStore()
const { pendingApprovals, fetchApprovals } = useApprovals()

const notifOpen = ref(false)
const paletteOpen = ref(false)
const onboardingOpen = ref(import.meta.client ? localStorage.getItem('nx-onboarded') !== '1' : false)

function toggleTheme () {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const notifCount = computed(() => pendingApprovals.value.length)

onMounted(() => {
  void workspaceStore.fetchWorkspaces()
  void fetchApprovals()
})

const pageMeta: Record<string, [string, string]> = {
  '/': ['Home', 'What needs you today'],
  '/chat': ['Chat', 'Talk to your team'],
  '/tasks': ['Tasks', 'Across all agents'],
  '/approvals': ['Approvals', 'Pending review'],
  '/settings/agents': ['Agents', 'Your AI team'],
  '/settings/integrations': ['Plugins', 'Integrations & tools'],
  '/settings/memory': ['Memory', 'What your AI has learned'],
  '/settings/runtime': ['Runtime', 'VPS health'],
  '/schedules': ['Schedules', 'Recurring jobs'],
  '/playbooks': ['Playbooks', 'Multi-step workflows'],
  '/settings': ['Settings', 'Account & business'],
  '/settings/profile': ['Settings', 'Business profile'],
  '/settings/team': ['Settings', 'Team'],
}

const pageTitle = computed(() => {
  const p = route.path
  const match = pageMeta[p] || pageMeta[Object.keys(pageMeta).find((k) => p.startsWith(k) && k !== '/') || ''] || [p, '']
  return match[0]
})
const pageSubtitle = computed(() => {
  const p = route.path
  const match = pageMeta[p] || pageMeta[Object.keys(pageMeta).find((k) => p.startsWith(k) && k !== '/') || ''] || ['', '']
  return match[1]
})

function onNav (to: string) {
  navigateTo(to)
}

// ⌘K
onMounted(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      paletteOpen.value = !paletteOpen.value
    }
    if (e.key === 'Escape') {
      paletteOpen.value = false
      notifOpen.value = false
    }
  }
  window.addEventListener('keydown', handler)
  onUnmounted(() => window.removeEventListener('keydown', handler))
})
</script>
