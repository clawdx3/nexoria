<template>
  <aside
    class="flex h-screen w-[276px] shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
  >
    <div class="flex h-16 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
      <img src="/logo.svg" alt="Nexoria" class="h-9 w-9 rounded-lg" />
      <div class="min-w-0">
        <div class="text-[15px] font-semibold tracking-tight">Nexoria</div>
        <div class="text-xs text-slate-500 dark:text-slate-400">Agent operations</div>
      </div>
    </div>

    <nav class="flex-1 overflow-y-auto px-3 py-4">
      <div class="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Workspace
      </div>
      <NuxtLink
        v-for="item in topNav"
        :key="item.to"
        :to="item.to"
        :class="[
          'mb-1 flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition',
          isActive(item.to)
            ? 'bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
        ]"
      >
        <component :is="item.icon" class="h-4 w-4 shrink-0" />
        <span>{{ item.label }}</span>
        <span v-if="item.badge" class="ml-auto rounded-md bg-cyan-100 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
          {{ item.badge }}
        </span>
      </NuxtLink>

      <div class="mt-6">
        <div class="mb-2 flex items-center justify-between px-2">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Active agents
          </div>
          <button class="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200" @click="navigateTo('/settings/agents')">
            <Plus class="h-3.5 w-3.5" />
          </button>
        </div>
        <div v-if="isLoading" class="px-3 py-2">
          <CommonLoadingSpinner size="sm" />
        </div>
        <NuxtLink
          v-for="agent in agents"
          :key="agent.id"
          :to="`/chat/${agent.id}`"
          :class="[
            'mb-1 flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition',
            route.path === `/chat/${agent.id}`
              ? 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
          ]"
        >
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <Bot class="h-3.5 w-3.5" />
          </span>
          <span class="truncate">{{ agent.name }}</span>
        </NuxtLink>
        <div v-if="!isLoading && agents.length === 0" class="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500 dark:border-slate-800">
          No agents in this workspace.
        </div>
      </div>
    </nav>

    <div class="border-t border-slate-200 p-3 dark:border-slate-800">
      <div class="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
        <div class="flex items-center justify-between text-xs">
          <span class="font-medium text-slate-600 dark:text-slate-300">System health</span>
          <span class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            Online
          </span>
        </div>
        <div class="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800">
          <div class="h-full w-[78%] rounded-full bg-cyan-500"></div>
        </div>
      </div>
      <NuxtLink
        v-for="item in bottomNav"
        :key="item.to"
        :to="item.to"
        :class="[
          'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition',
          route.path.startsWith(item.to)
            ? 'bg-slate-100 text-slate-950 dark:bg-slate-900 dark:text-slate-100'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
        ]"
      >
        <component :is="item.icon" class="h-4 w-4" />
        <span>{{ item.label }}</span>
      </NuxtLink>
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  LayoutDashboard,
  CheckCircle,
  FileCheck,
  MessageSquare,
  Settings,
  Bot,
  Brain,
  Plug,
  SlidersHorizontal,
  Plus,
  ServerCog
} from 'lucide-vue-next'

const { agents, isLoading, fetchAgents } = useAgent()
const route = useRoute()
const { pendingApprovals, fetchApprovals } = useApprovals()
const tasksStore = useTasksStore()

onMounted(() => {
  void fetchAgents()
  void fetchApprovals()
  void tasksStore.fetchTasks()
})

const topNav = computed(() => [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Agent Studio', to: '/settings/agents', icon: SlidersHorizontal },
  { label: 'Tasks', to: '/tasks', icon: CheckCircle, badge: tasksStore.tasks.length || undefined },
  { label: 'Approvals', to: '/approvals', icon: FileCheck, badge: pendingApprovals.value.length || undefined },
  { label: 'Memory', to: '/settings/memory', icon: Brain },
  { label: 'Runtime', to: '/settings/runtime', icon: ServerCog },
  { label: 'Integrations', to: '/settings/integrations', icon: Plug },
  { label: 'Chat', to: '/', icon: MessageSquare }
])

const bottomNav = [
  { label: 'Settings', to: '/settings', icon: Settings }
]

function isActive (to: string): boolean {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>
