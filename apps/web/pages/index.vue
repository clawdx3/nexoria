<template>
  <div class="nx-page-wide" style="max-width:1240px;margin:0 auto;padding:28px 32px 80px;">

    <!-- Greeting -->
    <div style="margin-bottom:26px;">
      <div class="text-tiny" style="margin-bottom:8px;">{{ todayLabel }}</div>
      <div class="nx-h-display" style="font-size:30px;">
        Good morning, {{ firstName }}.
        <span style="color:var(--muted);">{{ pendingCount }} thing{{ pendingCount === 1 ? '' : 's' }} need{{ pendingCount === 1 ? 's' : '' }} you today.</span>
      </div>
    </div>

    <!-- Quick ask -->
    <div class="nx-surface" style="padding:14px;margin-bottom:24px;">
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <span style="width:36px;height:36px;border-radius:10px;background:var(--accent);color:var(--accent-ink);display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;letter-spacing:-0.02em;flex-shrink:0;">TL</span>
        <div style="flex:1;">
          <button @click="navigateTo('/chat')" style="display:block;width:100%;text-align:left;padding:8px 4px;color:var(--muted);font-size:14px;">
            Ask Team Lead anything — "schedule 5 posts for next week", "summarize last week's results"…
          </button>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">
            <button
              v-for="p in starterPrompts"
              :key="p"
              class="nx-btn nx-btn-soft nx-btn-sm"
              style="height:26px;"
              @click="navigateTo('/chat')"
            >{{ p }}</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="nx-icon-btn bordered" title="Attach"><Paperclip :size="14" /></button>
          <button class="nx-icon-btn bordered" title="Voice"><Mic :size="14" /></button>
          <button class="nx-btn nx-btn-accent nx-btn-sm" @click="navigateTo('/chat')">
            <Send :size="13" /> Ask
          </button>
        </div>
      </div>
    </div>

    <!-- Main grid -->
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px;">

      <!-- Inbox -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="nx-h-title">Inbox</div>
            <span class="nx-tag accent">{{ allItems.length }}</span>
          </div>
          <div class="nx-seg">
            <button :class="{ on: filter === 'now' }" @click="filter = 'now'">Now · {{ nowItems.length }}</button>
            <button :class="{ on: filter === 'today' }" @click="filter = 'today'">Today · {{ todayItems.length }}</button>
            <button :class="{ on: filter === 'all' }" @click="filter = 'all'">All</button>
          </div>
        </div>

        <div class="nx-surface" style="overflow:hidden;">
          <div v-if="visibleItems.length === 0" style="padding:32px;text-align:center;">
            <div class="nx-h-heading" style="margin-bottom:4px;">You're caught up</div>
            <div style="font-size:13px;color:var(--muted);">Nothing in this filter. Nice work.</div>
          </div>
          <button
            v-for="(item, i) in visibleItems"
            :key="item.id"
            style="display:grid;grid-template-columns:auto auto 1fr auto auto;gap:12px;align-items:center;width:100%;padding:14px 16px;text-align:left;transition:background .12s;"
            :style="{ borderBottom: i < visibleItems.length - 1 ? '1px solid var(--line)' : 'none' }"
            @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'"
            @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.background = ''"
            @click="navigateTo(item.kind === 'approval' ? '/approvals' : '/tasks')"
          >
            <span :style="kindIconStyle(item.kind)" style="width:32px;height:32px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
              <Shield v-if="item.kind === 'approval'" :size="15" />
              <CheckSquare v-else-if="item.kind === 'task'" :size="15" />
              <Brain v-else :size="15" />
            </span>
            <NxAvatar :name="item.agentName" :color="item.agentColor" />
            <div style="min-width:0;">
              <div style="font-size:14px;font-weight:500;margin-bottom:2px;">{{ item.title }}</div>
              <div style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.preview }}</div>
            </div>
            <span v-if="item.status" class="nx-tag" :class="statusTone(item.status)">{{ item.status }}</span>
            <span style="font-size:11px;color:var(--muted);font-family:var(--font-mono);width:32px;text-align:right;">{{ item.time }}</span>
          </button>
        </div>
      </div>

      <!-- Right rail -->
      <div style="display:flex;flex-direction:column;gap:16px;">

        <!-- Agents -->
        <div class="nx-surface" style="overflow:hidden;">
          <div style="padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);">
            <div>
              <div class="nx-h-heading">Active agents</div>
              <div style="font-size:12px;color:var(--muted);margin-top:2px;">{{ enabledAgents.length }} of {{ allAgents.length }} enabled</div>
            </div>
            <button class="nx-btn nx-btn-ghost nx-btn-sm" @click="navigateTo('/settings/agents')">Manage</button>
          </div>
          <button
            v-for="(a, i) in allAgents.slice(0, 5)"
            :key="a.id"
            style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;text-align:left;transition:background .12s;"
            :style="{ borderTop: i === 0 ? 'none' : '1px solid var(--line)', opacity: a.isEnabled ? 1 : 0.5 }"
            @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'"
            @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.background = ''"
            @click="navigateTo(`/chat/${a.id}`)"
          >
            <NxAvatar :name="a.name" :color="agentColor(a)" />
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:500;">{{ a.name }}</div>
              <div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ a.role || 'Agent' }}</div>
            </div>
            <span v-if="a.isEnabled" class="nx-live-dot" />
            <span v-else style="width:6px;height:6px;border-radius:50%;background:var(--line-strong);" />
          </button>
          <div v-if="allAgents.length === 0" style="padding:24px;text-align:center;font-size:13px;color:var(--muted);">
            No agents yet. <button style="color:var(--accent);" @click="navigateTo('/settings/agents')">Add one →</button>
          </div>
        </div>

        <!-- Activity -->
        <div class="nx-surface" style="overflow:hidden;">
          <div style="padding:14px 16px;border-bottom:1px solid var(--line);">
            <div class="nx-h-heading">Today's activity</div>
          </div>
          <div style="padding:8px 14px 14px;">
            <div
              v-for="(item, i) in activityItems"
              :key="i"
              style="display:flex;gap:10px;padding:8px 0;"
            >
              <span style="font-size:11px;font-family:var(--font-mono);color:var(--muted);width:56px;flex-shrink:0;padding-top:2px;">{{ item.time }}</span>
              <NxAvatar :name="item.agentName" :color="item.agentColor" />
              <span style="font-size:13px;flex:1;">{{ item.title }}</span>
            </div>
            <div v-if="activityItems.length === 0" style="padding:16px 0;font-size:13px;color:var(--muted);">No activity yet today.</div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Shield, CheckSquare, Brain, Paperclip, Mic, Send } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const { user } = useAuth()
const { agents: rawAgents, fetchAgents } = useAgent()
const { allTasks, fetchTasks } = useTasks()
const { approvals, pendingApprovals, fetchApprovals } = useApprovals()

onMounted(() => {
  void fetchAgents()
  void fetchTasks()
  void fetchApprovals()
})

const firstName = computed(() => user.value?.firstName || 'there')

const todayLabel = computed(() => {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
})

const agentColorPalette = ['#C25B3F', '#7C5CC2', '#3F8FC2', '#5C9C6E', '#C29A3F']
function agentColor (a: any): string {
  if (a.metadata?.color) return a.metadata.color
  const idx = (a.name || '').charCodeAt(0) % agentColorPalette.length
  return agentColorPalette[idx]
}

const allAgents = computed(() => rawAgents.value || [])
const enabledAgents = computed(() => allAgents.value.filter((a: any) => a.isEnabled !== false))

// Build inbox items from real approvals + tasks
const allItems = computed(() => {
  const items: any[] = []
  for (const a of pendingApprovals.value.slice(0, 3)) {
    items.push({
      id: 'a-' + a.id,
      kind: 'approval',
      title: a.title,
      preview: a.description || '',
      agentName: a.metadata?.agentName || 'Agent',
      agentColor: agentColorPalette[0],
      status: 'pending',
      time: 'now',
      priority: 'now',
    })
  }
  for (const t of (allTasks.value || []).slice(0, 4)) {
    items.push({
      id: 't-' + t.id,
      kind: 'task',
      title: t.title,
      preview: t.description || '',
      agentName: t.metadata?.agentName || 'Agent',
      agentColor: agentColorPalette[2],
      status: t.status === 'done' ? 'done' : t.status === 'in_progress' ? 'running' : 'pending',
      time: 'today',
      priority: t.status === 'in_progress' ? 'now' : 'today',
    })
  }
  return items
})

const filter = ref<'now' | 'today' | 'all'>('now')
const nowItems = computed(() => allItems.value.filter((i) => i.priority === 'now'))
const todayItems = computed(() => allItems.value.filter((i) => i.priority === 'today'))
const visibleItems = computed(() => {
  if (filter.value === 'now') return nowItems.value
  if (filter.value === 'today') return todayItems.value
  return allItems.value
})

const pendingCount = computed(() => pendingApprovals.value.length)

const activityItems = computed(() => {
  return (allTasks.value || []).slice(0, 5).map((t: any) => ({
    time: new Date(t.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    title: t.title,
    agentName: t.metadata?.agentName || 'Agent',
    agentColor: agentColorPalette[1],
  }))
})

const starterPrompts = [
  'What needs my attention today?',
  'Plan a 7-day campaign',
  'Find 3 micro-influencers',
  'Draft a reply to last week\'s reviews',
]

function kindIconStyle (kind: string) {
  if (kind === 'approval') return { background: 'var(--bg-sunk)', color: 'var(--accent)' }
  if (kind === 'task') return { background: 'var(--bg-sunk)', color: 'var(--info)' }
  return { background: 'var(--bg-sunk)', color: 'var(--ink-2)' }
}

function statusTone (status: string) {
  if (status === 'pending') return 'warn'
  if (status === 'done') return 'ok'
  if (status === 'running') return 'info'
  return ''
}
</script>
