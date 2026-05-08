<template>
  <div class="nx-topbar">
    <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1;">
      <span style="font-size:14px;font-weight:600;">{{ title }}</span>
      <span v-if="subtitle" style="font-size:12px;color:var(--muted);">· {{ subtitle }}</span>
    </div>

    <div style="display:flex;align-items:center;gap:6px;">
      <button @click="emit('cmdK')" class="nx-btn nx-btn-ghost nx-btn-sm" style="height:30px;gap:8px;">
        <Sparkles :size="13" style="color:var(--accent);" /> Ask Nexoria
      </button>
      <div style="width:1px;height:20px;background:var(--line);margin:0 4px;" />
      <button @click="emit('notif')" class="nx-icon-btn" title="Notifications" style="position:relative;">
        <Bell :size="15" />
        <span v-if="notifCount" style="position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 2px var(--bg-elev);" />
      </button>
      <button @click="emit('theme')" class="nx-icon-btn" title="Toggle theme">
        <Sun v-if="theme === 'dark'" :size="15" />
        <Moon v-else :size="15" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bell, Sparkles, Sun, Moon } from 'lucide-vue-next'

defineProps<{
  title: string
  subtitle?: string
  theme: string
  notifCount?: number
}>()

const emit = defineEmits<{
  theme: []
  notif: []
  cmdK: []
}>()
</script>
