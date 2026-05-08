<template>
  <div class="nx-page-wide">
    <div style="margin-bottom:24px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <div class="text-tiny" style="margin-bottom:6px;">Operations</div>
        <div class="nx-h-display">Memory & Learning</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px;max-width:580px;">What your AI has learned about your business. Keep good memories, delete wrong ones — your team gets smarter every week.</div>
      </div>
      <button class="nx-btn nx-btn-ghost"><Download :size="13" /> Export</button>
    </div>

    <div style="margin-bottom:16px;">
      <div class="nx-seg">
        <button :class="{ on: filter === 'all' }" @click="filter = 'all'">All · {{ memories.length }}</button>
        <button v-for="t in types" :key="t" :class="{ on: filter === t }" @click="filter = t">{{ t }}</button>
      </div>
    </div>

    <div v-if="isLoading" style="padding:40px;text-align:center;color:var(--muted);font-size:13px;">Loading…</div>

    <div v-else-if="filteredMemories.length === 0" style="padding:64px;text-align:center;">
      <div class="nx-h-heading" style="margin-bottom:4px;">No memories yet</div>
      <div style="font-size:13px;color:var(--muted);">Your agents will add memories as they learn from your work.</div>
    </div>

    <div v-else class="nx-surface" style="overflow:hidden;">
      <div
        v-for="(m, i) in filteredMemories"
        :key="m.id"
        style="display:grid;grid-template-columns:auto 1fr auto auto;gap:14px;align-items:center;padding:14px 18px;"
        :style="{ borderBottom: i < filteredMemories.length - 1 ? '1px solid var(--line)' : 'none' }"
      >
        <span class="nx-tag dot" :class="typeTone(m.type)">{{ m.type || 'fact' }}</span>
        <div>
          <div style="font-size:13px;font-weight:500;">{{ m.content || m.text }}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">{{ m.source || 'Learned automatically' }} · used {{ m.useCount || 0 }} times</div>
        </div>
        <div style="width:110px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span style="font-size:11px;color:var(--muted);">Confidence</span>
            <span style="font-size:11px;font-family:var(--font-mono);">{{ Math.round((m.confidence || 0.8) * 100) }}%</span>
          </div>
          <div class="nx-bar"><span class="nx-bar-fill" :style="{ width: Math.round((m.confidence || 0.8) * 100) + '%' }" /></div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="nx-icon-btn" title="Keep"><Check :size="14" /></button>
          <button class="nx-icon-btn" title="Forget"><Trash :size="14" /></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Download, Check, Trash } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const { memories, isLoading, fetchMemories } = useMemory()
onMounted(() => { void fetchMemories() })

const types = ['preference', 'fact', 'pattern', 'rule']
const filter = ref('all')
const filteredMemories = computed(() => {
  if (filter.value === 'all') return memories.value
  return memories.value.filter((m: any) => (m.type || 'fact') === filter.value)
})

function typeTone (type: string) {
  if (type === 'rule') return 'danger'
  if (type === 'fact') return 'info'
  if (type === 'pattern') return 'accent'
  return 'ok'
}
</script>
