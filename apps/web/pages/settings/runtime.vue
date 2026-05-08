<template>
  <div class="nx-page-wide">
    <div style="margin-bottom:24px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <div class="text-tiny" style="margin-bottom:6px;">Operations</div>
        <div class="nx-h-display">Runtime</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px;">Your dedicated VPS running OpenClaw. Health, jobs, and generated files.</div>
      </div>
      <button class="nx-btn nx-btn-soft"><RefreshCw :size="13" /> Restart runtime</button>
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;">
      <div v-for="s in stats" :key="s.label" class="nx-surface" style="padding:14px;">
        <div class="text-tiny" style="margin-bottom:6px;">{{ s.label }}</div>
        <div style="display:flex;align-items:baseline;gap:8px;">
          <span style="font-size:22px;font-weight:600;letter-spacing:-0.02em;">{{ s.val }}</span>
          <span v-if="s.tag" class="nx-tag dot" :class="s.tone">{{ s.tag }}</span>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px;">{{ s.sub }}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;">
      <!-- Jobs -->
      <div class="nx-surface" style="overflow:hidden;">
        <div style="padding:14px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div class="nx-h-heading">Recent jobs</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px;">Background runs from your agents</div>
          </div>
        </div>
        <div
          v-for="(j, i) in jobs"
          :key="j.id"
          style="display:flex;align-items:center;gap:12px;padding:12px 16px;"
          :style="{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }"
        >
          <NxAvatar :name="j.agentProfileId || 'Agent'" :color="agentColorPalette[i % 4]" />
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:500;">{{ j.type || 'Job' }}</div>
            <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono);">{{ relativeTime(j.createdAt) }}</div>
          </div>
          <span class="nx-tag dot" :class="statusTone(j.status)">{{ j.status }}</span>
        </div>
        <div v-if="jobs.length === 0" style="padding:32px;text-align:center;font-size:13px;color:var(--muted);">No recent jobs.</div>
      </div>

      <!-- Files -->
      <div class="nx-surface" style="overflow:hidden;">
        <div style="padding:14px 16px;border-bottom:1px solid var(--line);">
          <div class="nx-h-heading">Generated files</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">Returned from runtime jobs</div>
        </div>
        <a
          v-for="(f, i) in files"
          :key="f.id"
          :href="artifactUrl(f)"
          target="_blank"
          rel="noopener"
          style="display:flex;align-items:center;gap:10px;padding:12px 14px;text-decoration:none;color:inherit;"
          :style="{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }"
        >
          <span style="width:28px;height:28px;border-radius:7px;background:var(--bg-sunk);display:inline-flex;align-items:center;justify-content:center;">
            <FileIcon :size="13" />
          </span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ f.filename }}</div>
            <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono);">{{ formatSize(f.sizeBytes) }}</div>
          </div>
          <span class="nx-icon-btn"><Download :size="14" /></span>
        </a>
        <div v-if="files.length === 0" style="padding:32px;text-align:center;font-size:13px;color:var(--muted);">No files yet.</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RefreshCw, Download } from 'lucide-vue-next'
import { File as FileIcon } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const { status: runtimeStatus, jobs: runtimeJobs, artifacts, fetchRuntime, artifactUrl } = useManagedRuntime()
onMounted(() => { void fetchRuntime() })

const agentColorPalette = ['#C25B3F', '#7C5CC2', '#3F8FC2', '#5C9C6E']

const isReady = computed(() => runtimeStatus.value?.status === 'ready')

const stats = computed(() => {
  const s = runtimeStatus.value
  const instance = s?.instance
  const activeCount = runtimeJobs.value.filter((j: any) => j.status === 'running' || j.status === 'pending').length
  return [
    {
      label: 'Status',
      val: s?.status ? cap(s.status) : '—',
      tone: isReady.value ? 'ok' : 'warn',
      tag: isReady.value ? 'live' : null,
      sub: instance?.lastHeartbeatAt ? `Last seen ${relativeTime(instance.lastHeartbeatAt)}` : 'No heartbeat yet',
    },
    {
      label: 'Mode',
      val: instance?.mode || '—',
      tone: 'ok',
      tag: null,
      sub: instance?.version ? `v${instance.version}` : 'unknown version',
    },
    {
      label: 'Active jobs',
      val: String(activeCount),
      tone: activeCount > 0 ? 'info' : 'ok',
      tag: activeCount > 0 ? 'running' : null,
      sub: 'currently in queue',
    },
    {
      label: 'Total jobs',
      val: String(runtimeJobs.value.length),
      tone: 'ok',
      tag: null,
      sub: 'all-time',
    },
  ]
})

const jobs = computed(() => runtimeJobs.value.slice(0, 8))
const files = computed(() => artifacts.value.slice(0, 8))

function statusTone (status: string) {
  if (status === 'completed') return 'ok'
  if (status === 'running' || status === 'pending') return 'info'
  if (status === 'failed' || status === 'rejected') return 'danger'
  return 'warn'
}

function cap (s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function formatSize (bytes?: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function relativeTime (iso?: string | null) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`
  return `${Math.round(sec / 86400)}d ago`
}
</script>
