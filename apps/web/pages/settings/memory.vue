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
        <span class="nx-tag dot" :class="typeTone(m.type)">{{ m.type }}</span>
        <div style="min-width:0;">
          <div style="font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span>{{ m.content }}</span>
            <span class="nx-tag" style="font-size:10px;text-transform:capitalize;">{{ memorySource(m) }}</span>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">
            <span style="text-transform:capitalize;">{{ m.tier }}</span> · {{ m.positiveUses }} kept · {{ m.negativeUses }} rejected · {{ validatedLabel(m) }}
          </div>
        </div>
        <div style="width:110px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span style="font-size:11px;color:var(--muted);">Confidence</span>
            <span style="font-size:11px;font-family:var(--font-mono);">{{ Math.round(m.confidence * 100) }}%</span>
          </div>
          <div class="nx-bar"><span class="nx-bar-fill" :style="{ width: Math.round(m.confidence * 100) + '%' }" /></div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="nx-icon-btn" title="Keep" @click="reviewMemory(m.id, 'approve')"><Check :size="14" /></button>
          <button class="nx-icon-btn" title="Forget" @click="reviewMemory(m.id, 'reject')"><Trash :size="14" /></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Download, Check, Trash } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const { memories, isLoading, fetchMemories, reviewMemory } = useMemory()
onMounted(() => { void fetchMemories() })

const types = computed(() => Array.from(new Set(memories.value.map((m: any) => m.type).filter(Boolean))))
const filter = ref('all')
const filteredMemories = computed(() => {
  if (filter.value === 'all') return memories.value
  return memories.value.filter((m: any) => m.type === filter.value)
})

function typeTone (type: string) {
  if (type === 'rule') return 'danger'
  if (type === 'fact') return 'info'
  if (type === 'pattern') return 'accent'
  return 'ok'
}

function memorySource (m: any): string {
  const src = m.metadata?.source
  if (src === 'reflection') return 'auto'
  if (src === 'reflection-tool') return 'reflect'
  if (src === 'mcp:create_memory' || src === 'manual') return 'manual'
  if (typeof src === 'string' && src.length > 0) return src
  return 'manual'
}

function validatedLabel (m: any): string {
  const ts = m.lastValidatedAt || m.createdAt
  if (!ts) return 'never validated'
  const ms = Date.now() - new Date(ts).getTime()
  const sec = Math.round(ms / 1000)
  const prefix = m.lastValidatedAt ? 'validated' : 'created'
  if (sec < 60) return `${prefix} just now`
  if (sec < 3600) return `${prefix} ${Math.round(sec / 60)}m ago`
  if (sec < 86400) return `${prefix} ${Math.round(sec / 3600)}h ago`
  return `${prefix} ${Math.round(sec / 86400)}d ago`
}
</script>
