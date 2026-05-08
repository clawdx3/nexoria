<template>
  <aside class="nx-sidebar">
    <!-- Workspace switcher -->
    <div style="padding: 12px 12px 6px;">
      <button style="display:flex;align-items:center;gap:10px;width:100%;padding:8px;border-radius:10px;background:var(--bg-sunk);border:1px solid var(--line);text-align:left;">
        <span style="width:28px;height:28px;border-radius:8px;background:var(--accent);color:var(--accent-ink);display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;letter-spacing:-0.02em;flex-shrink:0;">
          {{ workspaceInitials }}
        </span>
        <span class="nx-ws-meta" style="min-width:0;flex:1;">
          <span style="display:block;font-size:13px;font-weight:600;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ workspaceName }}</span>
          <span style="display:block;font-size:11px;color:var(--muted);line-height:1.2;">{{ workspacePlan }}</span>
        </span>
        <ChevronDown class="nx-ws-meta" :size="14" style="color:var(--muted);flex-shrink:0;" />
      </button>
    </div>

    <!-- Command bar -->
    <div style="padding:6px 12px 8px;">
      <button @click="emit('cmdK')" style="display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 10px;border-radius:8px;background:transparent;border:1px solid var(--line);color:var(--muted);font-size:12.5px;text-align:left;">
        <Search :size="14" />
        <span class="nx-ws-meta" style="flex:1;">Search or ask…</span>
        <span class="nx-kbd nx-ws-meta">⌘K</span>
      </button>
    </div>

    <!-- Nav -->
    <nav style="padding:0 8px;flex:1;overflow-y:auto;">
      <div style="padding:0 4px;">
        <LayoutNavItem v-for="item in mainNav" :key="item.to" :item="item" :current="route.path" />
      </div>

      <div class="nx-nav-group"><span>Build</span></div>
      <div style="padding:0 4px;">
        <LayoutNavItem v-for="item in buildNav" :key="item.to" :item="item" :current="route.path" />
      </div>

      <div class="nx-nav-group"><span>Operations</span></div>
      <div style="padding:0 4px;">
        <LayoutNavItem v-for="item in opsNav" :key="item.to" :item="item" :current="route.path" />
      </div>
    </nav>

    <!-- Footer -->
    <div style="padding:12px;border-top:1px solid var(--line);">
      <div class="nx-health" style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:9px;background:var(--bg-sunk);border:1px solid var(--line);margin-bottom:8px;">
        <span style="display:inline-flex;align-items:center;gap:8px;font-size:12px;">
          <span class="nx-live-dot" />
          <span>VPS · OpenClaw online</span>
        </span>
        <span class="mono" style="font-size:11px;color:var(--muted);">98%</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:4px;">
        <NxAvatar :name="userName" clay />
        <div class="nx-ws-meta" style="flex:1;min-width:0;">
          <div style="font-size:12.5px;font-weight:500;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ userName }}</div>
          <div style="font-size:11px;color:var(--muted);line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ userEmail }}</div>
        </div>
        <button class="nx-icon-btn" @click="navigateTo('/settings')" title="Settings">
          <Settings :size="15" />
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  Home, MessageSquare, CheckSquare, Shield, Bot, Plug, Workflow,
  Brain, Clock, Server, Settings, Search, ChevronDown
} from 'lucide-vue-next'

const emit = defineEmits<{ cmdK: [] }>()

const route = useRoute()
const { user } = useAuth()
const workspaceStore = useWorkspaceStore()
const { pendingApprovals } = useApprovals()
const tasksStore = useTasksStore()

const workspaceName = computed(() => workspaceStore.currentWorkspace?.name || 'My Workspace')
const workspacePlan = computed(() => 'Growth plan')
const workspaceInitials = computed(() => {
  const name = workspaceName.value
  return name.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
})
const userName = computed(() => {
  if (!user.value) return 'User'
  return `${user.value.firstName} ${user.value.lastName}`.trim()
})
const userEmail = computed(() => user.value?.email || '')

const mainNav = computed(() => [
  { to: '/', label: 'Home', icon: Home },
  { to: '/chat', label: 'Chat', icon: MessageSquare },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare, badge: tasksStore.tasks.length || null },
  { to: '/approvals', label: 'Approvals', icon: Shield, badge: pendingApprovals.value.length || null },
])

const buildNav = [
  { to: '/settings/agents', label: 'Agents', icon: Bot },
  { to: '/settings/integrations', label: 'Plugins', icon: Plug },
  { to: '/playbooks', label: 'Playbooks', icon: Workflow },
]

const opsNav = [
  { to: '/settings/memory', label: 'Memory', icon: Brain },
  { to: '/schedules', label: 'Schedules', icon: Clock },
  { to: '/settings/runtime', label: 'Runtime', icon: Server },
]
</script>
