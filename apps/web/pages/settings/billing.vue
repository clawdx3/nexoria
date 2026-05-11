<template>
  <div class="nx-page-wide">

    <!-- Page header -->
    <div style="margin-bottom:24px;">
      <div class="text-tiny" style="margin-bottom:6px;">Account</div>
      <div class="nx-h-display">Billing & Plan</div>
      <div style="font-size:13px;color:var(--muted);margin-top:6px;max-width:580px;">Your current plan, usage, and limits.</div>
    </div>

    <!-- Current plan card -->
    <div class="nx-surface" style="padding:18px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
        <div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">Current plan</div>
          <div class="nx-h-title">{{ planName }}</div>
          <div style="font-size:13px;color:var(--muted);margin-top:4px;">{{ planDescription }}</div>
        </div>
        <button
          v-if="planTier !== 'enterprise'"
          class="nx-btn nx-btn-accent nx-btn-lg"
          @click="upgradePlan"
        >
          <ArrowUpRight :size="14" /> Upgrade Plan
        </button>
        <span v-else class="nx-tag accent">Contact us</span>
      </div>
    </div>

    <!-- Plan comparison table -->
    <div class="nx-surface" style="overflow:hidden;margin-bottom:20px;">
      <div style="padding:14px 18px;border-bottom:1px solid var(--line);">
        <div class="nx-h-heading">Plan limits</div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid var(--line);">
              <th style="text-align:left;padding:10px 18px;font-weight:500;color:var(--muted);font-size:12px;">Feature</th>
              <th style="text-align:center;padding:10px 14px;font-weight:500;color:var(--muted);font-size:12px;">Free</th>
              <th style="text-align:center;padding:10px 14px;font-weight:500;color:var(--muted);font-size:12px;">Lite</th>
              <th style="text-align:center;padding:10px 14px;font-weight:500;color:var(--muted);font-size:12px;">Pro</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in planLimits" :key="row.feature" style="border-bottom:1px solid var(--line);">
              <td style="padding:10px 18px;font-weight:500;">{{ row.feature }}</td>
              <td style="text-align:center;padding:10px 14px;color:var(--ink-2);">{{ row.free }}</td>
              <td style="text-align:center;padding:10px 14px;color:var(--ink-2);">{{ row.lite }}</td>
              <td style="text-align:center;padding:10px 14px;font-weight:600;">{{ row.pro }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Usage meters -->
    <div class="nx-surface" style="padding:18px;">
      <div class="nx-h-heading" style="margin-bottom:16px;">Usage this period</div>
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div v-for="meter in usageMeters" :key="meter.label">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:13px;font-weight:500;">{{ meter.label }}</span>
            <span style="font-size:12px;font-family:var(--font-mono);color:var(--ink-2);">{{ meter.used }} / {{ meter.limit }}</span>
          </div>
          <div class="nx-bar">
            <span
              class="nx-bar-fill"
              :style="{ width: Math.min(meter.percent, 100) + '%', background: meter.percent > 90 ? 'var(--danger)' : meter.percent > 70 ? 'var(--warn)' : undefined }"
            />
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ArrowUpRight } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const { ensureWorkspace } = useWorkspace()
const isLoading = ref(true)
const planTier = ref<'free' | 'lite' | 'pro' | 'enterprise'>('free')
const usage = ref<{ messagesToday: number; messagesLimit: number; storageUsed: string; storageLimit: string; runtimeMinutes: number; runtimeLimit: number }>({
  messagesToday: 0,
  messagesLimit: 50,
  storageUsed: '0 MB',
  storageLimit: '100 MB',
  runtimeMinutes: 0,
  runtimeLimit: 300,
})

const planName = computed(() => {
  const names: Record<string, string> = { free: 'Free', lite: 'Lite', pro: 'Pro', enterprise: 'Enterprise' }
  return names[planTier.value] || 'Free'
})

const planDescription = computed(() => {
  const descs: Record<string, string> = {
    free: 'For individuals exploring Nexoria.',
    lite: 'For small teams with growing needs.',
    pro: 'For teams running Pro agents at scale.',
    enterprise: 'Custom limits and dedicated support.',
  }
  return descs[planTier.value] || ''
})

const planLimits = [
  { feature: 'Workspaces', free: '1', lite: '3', pro: 'Unlimited' },
  { feature: 'Lite Agents', free: '2', lite: '5', pro: 'Unlimited' },
  { feature: 'Pro Agents', free: '—', lite: '—', pro: 'Unlimited' },
  { feature: 'Messages / day', free: '50', lite: '500', pro: 'Unlimited' },
  { feature: 'Storage', free: '100 MB', lite: '1 GB', pro: '10 GB' },
]

function parseSizeToMB (s: string): number {
  const match = s.match(/([\d.]+)\s*(MB|GB)/i)
  if (!match) return 0
  const val = parseFloat(match[1])
  return match[2].toUpperCase() === 'GB' ? val * 1024 : val
}

const usageMeters = computed(() => [
  {
    label: 'Messages sent today',
    used: String(usage.value.messagesToday),
    limit: usage.value.messagesLimit === Infinity ? 'Unlimited' : String(usage.value.messagesLimit),
    percent: usage.value.messagesLimit === Infinity ? 0 : (usage.value.messagesToday / usage.value.messagesLimit) * 100,
  },
  {
    label: 'Storage used',
    used: usage.value.storageUsed,
    limit: usage.value.storageLimit,
    percent: (parseSizeToMB(usage.value.storageUsed) / parseSizeToMB(usage.value.storageLimit)) * 100,
  },
  {
    label: 'Agent runtime minutes',
    used: String(usage.value.runtimeMinutes),
    limit: usage.value.runtimeLimit === Infinity ? 'Unlimited' : String(usage.value.runtimeLimit),
    percent: usage.value.runtimeLimit === Infinity ? 0 : (usage.value.runtimeMinutes / usage.value.runtimeLimit) * 100,
  },
])

function upgradePlan () {
  window.open('https://nexoria.ai/billing', '_blank')
}

async function fetchData () {
  isLoading.value = true
  try {
    const wsId = await ensureWorkspace()
    if (!wsId) return
    try {
      const workspace = await useApi<any>(`/workspaces/${wsId}`)
      planTier.value = workspace.plan || workspace.planTier || 'free'
    } catch {
      planTier.value = 'free'
    }
    try {
      const u = await useApi<any>(`/workspaces/${wsId}/usage`)
      usage.value = {
        messagesToday: u.messagesToday ?? 0,
        messagesLimit: u.messagesLimit ?? 50,
        storageUsed: u.storageUsed ?? '0 MB',
        storageLimit: u.storageLimit ?? '100 MB',
        runtimeMinutes: u.runtimeMinutes ?? 0,
        runtimeLimit: u.runtimeLimit ?? 300,
      }
    } catch {
      // Keep placeholder defaults
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(() => { void fetchData() })
</script>
