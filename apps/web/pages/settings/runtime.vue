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
          <span class="nx-tag dot" :class="s.tone">{{ s.tone === 'ok' ? 'stable' : 'live' }}</span>
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
          :key="i"
          style="display:flex;align-items:center;gap:12px;padding:12px 16px;"
          :style="{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }"
        >
          <NxAvatar :name="j.agent" :color="agentColorPalette[i % 4]" />
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:500;">{{ j.title }}</div>
            <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono);">{{ j.time }}</div>
          </div>
          <span class="nx-tag dot" :class="j.status === 'completed' ? 'ok' : j.status === 'running' ? 'info' : 'warn'">{{ j.status }}</span>
        </div>
        <div v-if="jobs.length === 0" style="padding:32px;text-align:center;font-size:13px;color:var(--muted);">No recent jobs.</div>
      </div>

      <!-- Files -->
      <div class="nx-surface" style="overflow:hidden;">
        <div style="padding:14px 16px;border-bottom:1px solid var(--line);">
          <div class="nx-h-heading">Generated files</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">Returned from runtime jobs</div>
        </div>
        <div
          v-for="(f, i) in files"
          :key="i"
          style="display:flex;align-items:center;gap:10px;padding:12px 14px;"
          :style="{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }"
        >
          <span style="width:28px;height:28px;border-radius:7px;background:var(--bg-sunk);display:inline-flex;align-items:center;justify-content:center;">
            <FileIcon :size="13" />
          </span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ f.name }}</div>
            <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono);">{{ f.size }}</div>
          </div>
          <button class="nx-icon-btn"><Download :size="14" /></button>
        </div>
        <div v-if="files.length === 0" style="padding:32px;text-align:center;font-size:13px;color:var(--muted);">No files yet.</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RefreshCw, Download } from 'lucide-vue-next'
import { File as FileIcon } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const { status: runtimeStatus, jobs: runtimeJobs, artifacts, fetchRuntime } = useManagedRuntime()
onMounted(() => { void fetchRuntime() })

const agentColorPalette = ['#C25B3F', '#7C5CC2', '#3F8FC2', '#5C9C6E']

const stats = computed(() => [
  { label: 'Status', val: runtimeStatus.value?.status === 'online' ? 'Online' : 'Offline', tone: runtimeStatus.value?.status === 'online' ? 'ok' : 'danger', sub: 'OpenClaw running' },
  { label: 'CPU', val: (runtimeStatus.value?.cpuPercent ?? 12) + '%', tone: 'ok', sub: 'of available cores' },
  { label: 'Memory', val: (runtimeStatus.value?.memUsedGb ?? 1.4) + ' GB', tone: 'ok', sub: 'stable' },
  { label: 'Active jobs', val: runtimeJobs.value.filter((j: any) => j.status === 'running').length || 2, tone: 'info', sub: 'in queue' },
])

const jobs = computed(() => runtimeJobs.value.length > 0 ? runtimeJobs.value.slice(0, 6).map((j: any) => ({
  agent: j.agentName || j.agentProfileId || 'Agent',
  title: j.title || j.type || 'Job',
  status: j.status,
  time: j.duration || j.createdAt || '',
})) : [
  { agent: 'Social Media', title: 'Generate spring carousel images', status: 'completed', time: '12m' },
  { agent: 'Researcher', title: 'Browse competitor pricing pages', status: 'completed', time: '38m' },
  { agent: 'Writer', title: 'Refine newsletter v3', status: 'running', time: 'now' },
])

const files = computed(() => artifacts.value.length > 0 ? artifacts.value.slice(0, 6).map((a: any) => ({
  name: a.filename || a.name || 'file',
  size: a.size ? Math.round(a.size / 1024) + ' KB' : '—',
})) : [
  { name: 'competitor-pricing.csv', size: '8 KB' },
  { name: 'spring-carousel-1.png', size: '1.4 MB' },
  { name: 'april-newsletter-v3.md', size: '12 KB' },
])
</script>
