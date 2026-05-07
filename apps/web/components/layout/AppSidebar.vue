<template>
  <aside
    class="flex h-screen w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
  >
    <div class="flex h-16 items-center gap-3 px-4">
      <img src="/logo.svg" alt="Nexoria" class="h-8 w-8" />
      <span class="text-lg font-semibold tracking-tight">Nexoria</span>
    </div>

    <nav class="flex-1 space-y-1 px-3 py-4">
      <UButton
        v-for="item in topNav"
        :key="item.to"
        variant="ghost"
        color="gray"
        :class="[
          'w-full justify-start gap-3',
          $route.path === item.to ? 'bg-slate-100 dark:bg-slate-800' : ''
        ]"
        :to="item.to"
        @click="navigateTo(item.to)"
      >
        <component :is="item.icon" class="h-5 w-5" />
        <span>{{ item.label }}</span>
      </UButton>

      <div class="pt-4">
        <div class="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
          Agents
        </div>
        <div v-if="isLoading" class="px-3 py-2">
          <LoadingSpinner size="sm" />
        </div>
        <UButton
          v-for="agent in agents"
          :key="agent.id"
          variant="ghost"
          color="gray"
          :class="[
            'w-full justify-start gap-3',
            $route.path === `/chat/${agent.id}` ? 'bg-slate-100 dark:bg-slate-800' : ''
          ]"
          @click="navigateTo(`/chat/${agent.id}`)"
        >
          <Bot class="h-5 w-5" />
          <span class="truncate">{{ agent.name }}</span>
        </UButton>
      </div>
    </nav>

    <div class="border-t border-slate-200 p-3 dark:border-slate-800">
      <UButton
        v-for="item in bottomNav"
        :key="item.to"
        variant="ghost"
        color="gray"
        :class="[
          'w-full justify-start gap-3',
          $route.path.startsWith(item.to) ? 'bg-slate-100 dark:bg-slate-800' : ''
        ]"
        @click="navigateTo(item.to)"
      >
        <component :is="item.icon" class="h-5 w-5" />
        <span>{{ item.label }}</span>
      </UButton>
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  LayoutDashboard,
  CheckCircle,
  MessageSquare,
  Settings,
  Bot
} from 'lucide-vue-next'

const { agents, isLoading, fetchAgents } = useAgent()
const route = useRoute()

onMounted(() => { void fetchAgents() })

const topNav = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Chat', to: '/', icon: MessageSquare },
  { label: 'Tasks', to: '/tasks', icon: CheckCircle },
  { label: 'Approvals', to: '/approvals', icon: CheckCircle }
]

const bottomNav = [
  { label: 'Settings', to: '/settings', icon: Settings }
]
</script>
