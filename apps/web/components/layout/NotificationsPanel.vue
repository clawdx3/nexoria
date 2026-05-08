<template>
  <template v-if="open">
    <div class="nx-scrim" style="background:transparent;" @click="emit('close')" />
    <div style="position:fixed;top:60px;right:18px;z-index:60;width:380px;background:var(--bg-elev);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow-3);overflow:hidden;">
      <div style="padding:14px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;">
        <div style="font-size:15px;font-weight:600;letter-spacing:-0.01em;">Notifications</div>
        <button style="font-size:12px;color:var(--muted);">Mark all read</button>
      </div>
      <div style="max-height:480px;overflow-y:auto;">
        <div
          v-for="(n, i) in notifications"
          :key="n.id"
          style="display:flex;gap:10px;padding:12px 16px;"
          :style="{ borderBottom: i < notifications.length - 1 ? '1px solid var(--line)' : 'none' }"
        >
          <span :style="iconStyle(n.kind)" style="width:28px;height:28px;border-radius:8px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;">
            <Shield v-if="n.kind === 'approval'" :size="13" />
            <CheckSquare v-else-if="n.kind === 'task'" :size="13" />
            <Brain v-else-if="n.kind === 'memory'" :size="13" />
            <Server v-else :size="13" />
          </span>
          <div style="flex:1;">
            <div style="font-size:13px;line-height:1.4;">{{ n.text }}</div>
            <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono);margin-top:2px;">{{ n.time }} ago</div>
          </div>
        </div>
        <div v-if="notifications.length === 0" style="padding:32px;text-align:center;font-size:13px;color:var(--muted);">
          No notifications
        </div>
      </div>
      <div style="padding:10px;background:var(--bg-sunk);border-top:1px solid var(--line);text-align:center;">
        <button style="font-size:12px;color:var(--muted);" @click="emit('close')">View all activity →</button>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { Shield, CheckSquare, Brain, Server } from 'lucide-vue-next'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { pendingApprovals } = useApprovals()

const notifications = computed(() => {
  return pendingApprovals.value.slice(0, 5).map((a: any) => ({
    id: a.id,
    kind: 'approval',
    text: a.title || 'New approval request',
    time: 'just now',
  }))
})

function iconStyle (kind: string) {
  if (kind === 'approval') return { background: 'var(--accent-soft)', color: 'var(--accent-soft-ink)' }
  if (kind === 'task') return { background: 'var(--info-soft)', color: 'var(--info)' }
  if (kind === 'memory') return { background: 'var(--ok-soft)', color: 'var(--ok)' }
  return { background: 'var(--bg-sunk)', color: 'var(--ink-2)' }
}
</script>
