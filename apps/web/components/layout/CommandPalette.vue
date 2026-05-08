<template>
  <template v-if="open">
    <div class="nx-scrim" @click="emit('close')" />
    <div class="nx-modal" style="width:540px;top:32%;padding:0;">
      <div style="padding:14px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line);">
        <Sparkles :size="16" style="color:var(--accent);flex-shrink:0;" />
        <input
          ref="inputRef"
          v-model="query"
          placeholder="Ask Nexoria, or jump anywhere…"
          style="flex:1;border:none;outline:none;background:transparent;font-size:15px;color:var(--ink);font-family:var(--font-sans);"
        />
        <span class="nx-kbd">esc</span>
      </div>
      <div style="padding:8px 8px 12px;">
        <div class="text-tiny" style="padding:8px 10px 4px;">Quick actions</div>
        <button
          v-for="cmd in filteredCmds"
          :key="cmd.label"
          style="display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border-radius:8px;text-align:left;"
          @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.background = 'var(--bg-sunk)'"
          @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.background = ''"
          @click="go(cmd.to)"
        >
          <component :is="cmd.icon" :size="15" />
          <span style="font-size:13.5px;flex:1;">{{ cmd.label }}</span>
          <CornerDownLeft :size="12" style="color:var(--muted);" />
        </button>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { MessageSquare, Plus, Shield, Bot, Plug, Workflow, Sparkles, CornerDownLeft } from 'lucide-vue-next'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; nav: [to: string] }>()

const query = ref('')
const inputRef = ref<HTMLInputElement>()

watch(() => props.open, (val) => {
  if (val) {
    query.value = ''
    nextTick(() => inputRef.value?.focus())
  }
})

const cmds = [
  { icon: MessageSquare, label: 'Ask Team Lead', to: '/chat' },
  { icon: Plus, label: 'Create new task', to: '/tasks' },
  { icon: Shield, label: 'Review approvals', to: '/approvals' },
  { icon: Bot, label: 'Build a custom agent', to: '/settings/agents' },
  { icon: Plug, label: 'Connect a plugin', to: '/settings/integrations' },
  { icon: Workflow, label: 'New playbook', to: '/playbooks' },
]

const filteredCmds = computed(() => {
  if (!query.value) return cmds
  const q = query.value.toLowerCase()
  return cmds.filter((c) => c.label.toLowerCase().includes(q))
})

function go (to: string) {
  emit('nav', to)
  emit('close')
}
</script>
