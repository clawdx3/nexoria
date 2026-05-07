<template>
  <div class="min-h-full bg-slate-100 dark:bg-slate-950">
    <div class="border-b border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-950">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
            <Activity class="h-3.5 w-3.5" />
            Command center
          </div>
          <h1 class="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Run the workspace from one screen
          </h1>
          <p class="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Agent chat, open tasks, approvals, and operational memory stay visible while work moves.
          </p>
        </div>

        <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div v-for="metric in metrics" :key="metric.label" class="min-w-[136px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
            <div class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ metric.label }}</div>
            <div class="mt-1 flex items-end justify-between gap-3">
              <span class="text-xl font-semibold text-slate-950 dark:text-white">{{ metric.value }}</span>
              <span :class="['text-xs font-medium', metric.tone]">{{ metric.delta }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)] 2xl:grid-cols-[minmax(0,1.35fr)_420px_360px]">
      <section class="flex min-h-[650px] flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div class="flex items-center gap-3">
            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300">
              <Bot class="h-4 w-4" />
            </span>
            <div>
              <h2 class="text-sm font-semibold text-slate-950 dark:text-white">Team Lead</h2>
              <p class="text-xs text-slate-500">Orchestrates agent work and creates follow-up tasks.</p>
            </div>
          </div>
          <AgentSelector
            :agents="agents"
            :model-value="selectedAgentId"
            @update:model-value="selectedAgentId = $event"
          />
        </div>

        <div ref="scrollRef" class="flex-1 overflow-y-auto px-5 py-5">
          <div v-if="chatStore.messages.length === 0" class="grid h-full place-items-center">
            <div class="max-w-xl text-center">
              <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <Command class="h-5 w-5" />
              </div>
              <h3 class="mt-4 text-base font-semibold text-slate-950 dark:text-white">What needs to move today?</h3>
              <p class="mt-2 text-sm text-slate-500">
                Ask the orchestrator to draft tasks, inspect approvals, summarize memory, or run an agent workflow.
              </p>
              <div class="mt-5 grid gap-2 text-left sm:grid-cols-2">
                <button
                  v-for="prompt in starterPrompts"
                  :key="prompt"
                  class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-cyan-800 dark:hover:text-cyan-300"
                  @click="sendPrompt(prompt)"
                >
                  {{ prompt }}
                </button>
              </div>
            </div>
          </div>

          <div v-else class="space-y-5">
            <ChatMessage
              v-for="msg in chatStore.messages"
              :key="msg.id"
              :role="msg.role"
              :content="msg.content"
              :agent-name="msg.agentName"
            />
            <div v-if="chatStore.isLoading" class="flex items-center gap-2 text-sm text-slate-500">
              <CommonLoadingSpinner size="sm" />
              <span>Agent runtime is working...</span>
            </div>
          </div>
        </div>

        <div class="border-t border-slate-200 p-4 dark:border-slate-800">
          <div class="flex items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
            <UTextarea
              v-model="message"
              placeholder="Ask Nexoria to run an agent, draft a task, or review an approval..."
              :rows="1"
              :maxrows="5"
              autoresize
              class="min-h-[38px] flex-1"
              :disabled="chatStore.isLoading"
              @keydown="onKeydown"
            />
            <UButton color="cyan" :disabled="!message.trim() || chatStore.isLoading" class="h-9 gap-2" @click="sendMessage">
              <Send class="h-4 w-4" />
              Send
            </UButton>
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <div class="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div>
              <h2 class="text-sm font-semibold text-slate-950 dark:text-white">Task queue</h2>
              <p class="text-xs text-slate-500">{{ taskRows.length }} active items</p>
            </div>
            <UButton size="xs" variant="ghost" color="gray" @click="navigateTo('/tasks')">View all</UButton>
          </div>
          <div v-if="taskRows.length === 0" class="px-4 py-8 text-center text-sm text-slate-500">
            No tasks in this workspace yet.
          </div>
          <div v-else class="divide-y divide-slate-100 dark:divide-slate-800">
            <div v-for="task in taskRows" :key="task.id" class="px-4 py-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium text-slate-950 dark:text-white">{{ task.title }}</div>
                  <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{{ task.owner }}</span>
                    <span class="h-1 w-1 rounded-full bg-slate-300"></span>
                    <span>{{ task.due }}</span>
                  </div>
                </div>
                <span :class="['shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold', statusClass(task.status)]">
                  {{ task.statusLabel }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div>
              <h2 class="text-sm font-semibold text-slate-950 dark:text-white">Pending approvals</h2>
              <p class="text-xs text-slate-500">Items waiting for a human decision</p>
            </div>
            <UButton size="xs" variant="ghost" color="gray" @click="navigateTo('/approvals')">Review</UButton>
          </div>
          <div v-if="approvalRows.length === 0" class="px-4 py-8 text-center text-sm text-slate-500">
            No approvals are waiting.
          </div>
          <div v-else class="divide-y divide-slate-100 dark:divide-slate-800">
            <div v-for="approval in approvalRows" :key="approval.id" class="px-4 py-3">
              <div class="flex items-start gap-3">
                <span :class="['mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', approval.iconBg]">
                  <component :is="approval.icon" class="h-4 w-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium text-slate-950 dark:text-white">{{ approval.title }}</div>
                  <div class="mt-1 text-xs text-slate-500">{{ approval.meta }}</div>
                </div>
                <span class="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                  Pending
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="space-y-4 xl:col-span-2 2xl:col-span-1">
        <div class="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div class="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 class="text-sm font-semibold text-slate-950 dark:text-white">Active agents</h2>
            <p class="text-xs text-slate-500">{{ agentRows.length }} available in this workspace</p>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-800">
            <button
              v-for="agent in agentRows"
              :key="agent.id"
              class="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-900"
              @click="agent.id.startsWith('demo-') ? navigateTo('/settings/agents') : navigateTo(`/chat/${agent.id}`)"
            >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <component :is="agent.icon" class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-slate-950 dark:text-white">{{ agent.name }}</span>
                <span class="block truncate text-xs text-slate-500">{{ agent.description }}</span>
              </span>
              <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
            </button>
          </div>
        </div>

        <div class="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div class="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <h2 class="text-sm font-semibold text-slate-950 dark:text-white">Memory and activity</h2>
            <p class="text-xs text-slate-500">Recent context the runtime can use</p>
          </div>
          <div class="px-4 py-4">
            <div class="space-y-4">
              <div v-for="item in activityRows" :key="item.title" class="flex gap-3">
                <div class="flex flex-col items-center">
                  <span :class="['flex h-7 w-7 items-center justify-center rounded-lg', item.bg]">
                    <component :is="item.icon" class="h-3.5 w-3.5" />
                  </span>
                  <span class="mt-2 h-full w-px bg-slate-200 last:hidden dark:bg-slate-800"></span>
                </div>
                <div class="min-w-0 pb-3">
                  <div class="text-sm font-medium text-slate-950 dark:text-white">{{ item.title }}</div>
                  <div class="mt-1 text-xs leading-5 text-slate-500">{{ item.body }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  Activity,
  Bot,
  Brain,
  CheckCircle2,
  Command,
  FileCheck2,
  Gauge,
  Send,
  ShieldCheck
} from 'lucide-vue-next'
import type { Task } from '~/types'

definePageMeta({ middleware: 'auth' })

const chatStore = useChatStore()
const { agents, fetchAgents } = useAgent()
const { allTasks, fetchTasks } = useTasks()
const { approvals, fetchApprovals } = useApprovals()

const selectedAgentId = ref<string | null>(null)
const message = ref('')
const scrollRef = ref<HTMLDivElement | null>(null)

onMounted(() => {
  void fetchAgents()
  void fetchTasks()
  void fetchApprovals()
})

const starterPrompts = [
  'Summarize open approvals and next actions',
  'Create a launch checklist for this week',
  'Find tasks blocked by missing context',
  'Draft a customer follow-up workflow'
]

const metrics = computed(() => [
  { label: 'Active agents', value: agentRows.value.length, delta: '+2', tone: 'text-emerald-600 dark:text-emerald-400' },
  { label: 'Open tasks', value: activeTasks.value.length, delta: 'Live', tone: 'text-cyan-600 dark:text-cyan-400' },
  { label: 'Approvals', value: approvalRows.value.length, delta: 'Needs review', tone: 'text-amber-600 dark:text-amber-400' },
  { label: 'Runtime health', value: '98%', delta: 'Stable', tone: 'text-emerald-600 dark:text-emerald-400' }
])

const activeTasks = computed(() => (
  allTasks.value.filter((task: Task) => !['done', 'cancelled'].includes(task.status))
))

const taskRows = computed(() => {
  return activeTasks.value.slice(0, 5).map((task: Task) => ({
    id: task.id,
    title: task.title,
    owner: task.metadata?.agentName || 'Team Lead',
    due: task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date',
    status: task.status,
    statusLabel: task.status.replace('_', ' ')
  }))
})

const approvalRows = computed(() => {
  return approvals.value.filter((approval: any) => approval.status === 'pending').slice(0, 4).map((approval: any) => ({
    id: approval.id,
    title: approval.title,
    meta: approval.description || approval.type || 'Approval request',
    icon: FileCheck2,
    iconBg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
  }))
})

const agentRows = computed(() => {
  const realAgents = agents.value.slice(0, 5).map((agent: any) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description || agent.role || 'Workspace agent',
    icon: Bot
  }))

  return realAgents.length > 0 ? realAgents : [
    { id: 'demo-agent-1', name: 'Team Lead', description: 'Routes work to specialist agents', icon: Bot },
    { id: 'demo-agent-2', name: 'Operations Agent', description: 'Tracks tasks and approvals', icon: Gauge },
    { id: 'demo-agent-3', name: 'Memory Agent', description: 'Maintains workspace context', icon: Brain },
    { id: 'demo-agent-4', name: 'Systems Agent', description: 'Checks integrations and tools', icon: ShieldCheck }
  ]
})

const activityRows = [
  {
    title: 'Daily memory assembled',
    body: 'Customer tone, active workflows, and unresolved approvals were added to runtime context.',
    icon: Brain,
    bg: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300'
  },
  {
    title: 'Approval guard active',
    body: 'Risk level 2 and 3 tool calls require human confirmation before execution.',
    icon: ShieldCheck,
    bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
  },
  {
    title: 'Task queue normalized',
    body: 'Open work is grouped by mission and prioritized by due date.',
    icon: CheckCircle2,
    bg: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300'
  }
]

function statusClass (status: string): string {
  switch (status) {
    case 'done':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
    case 'in_progress':
      return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300'
    case 'cancelled':
      return 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
    default:
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
  }
}

function sendPrompt (prompt: string): void {
  message.value = prompt
  sendMessage()
}

function sendMessage (): void {
  const content = message.value.trim()
  if (!content || chatStore.isLoading) return
  void chatStore.sendMessage(content, selectedAgentId.value || undefined)
  message.value = ''
}

function onKeydown (event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault()
    sendMessage()
  }
}

watch(() => chatStore.messages.length, async () => {
  await nextTick()
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  }
})
</script>
