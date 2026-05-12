<template>
  <div class="nx-page-wide">

    <!-- Page header -->
    <div style="margin-bottom:24px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <div class="text-tiny" style="margin-bottom:6px;">Infrastructure</div>
        <div class="nx-h-display">Agent Servers</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px;max-width:580px;">Manage the virtual servers that run your Pro agents.</div>
      </div>
      <button class="nx-btn nx-btn-accent" @click="provisionModal = true">
        <Plus :size="13" /> Provision New Server
      </button>
    </div>

    <div v-if="isLoading" style="padding:40px;text-align:center;color:var(--muted);font-size:13px;">Loading…</div>

    <!-- Empty state -->
    <div v-else-if="instances.length === 0" class="nx-surface" style="padding:64px;text-align:center;">
      <div style="width:56px;height:56px;border-radius:16px;background:var(--bg-sunk);color:var(--ink-2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
        <Server :size="24" />
      </div>
      <div class="nx-h-title" style="margin-bottom:6px;">No agent servers yet</div>
      <div style="font-size:13px;color:var(--muted);max-width:360px;margin:0 auto 20px;">Provision one to run Pro agents.</div>
      <button class="nx-btn nx-btn-accent" @click="provisionModal = true">
        <Plus :size="13" /> Provision New Server
      </button>
    </div>

    <!-- VPS instances -->
    <div v-else style="display:flex;flex-direction:column;gap:14px;">
      <div v-for="vps in instances" :key="vps.id" class="nx-surface" style="padding:18px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span
              style="width:10px;height:10px;border-radius:50%;flex-shrink:0;"
              :style="{ background: statusColor(vps.status) }"
            />
            <div>
              <div class="nx-h-heading">{{ vps.name || vps.provider }}</div>
              <div style="font-size:12px;color:var(--muted);">{{ vps.provider }} · {{ vps.region }}</div>
            </div>
          </div>
          <span class="nx-tag dot" :class="statusTag(vps.status)">{{ vps.status }}</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:14px;">
          <div style="padding:8px 10px;background:var(--bg-sunk);border-radius:8px;">
            <div style="font-size:11px;color:var(--muted);margin-bottom:2px;">Size</div>
            <div style="font-size:13px;font-weight:500;">{{ vps.size }}</div>
          </div>
          <div style="padding:8px 10px;background:var(--bg-sunk);border-radius:8px;">
            <div style="font-size:11px;color:var(--muted);margin-bottom:2px;">IP Address</div>
            <div style="font-size:13px;font-weight:500;font-family:var(--font-mono);">{{ vps.ip || '—' }}</div>
          </div>
          <div style="padding:8px 10px;background:var(--bg-sunk);border-radius:8px;">
            <div style="font-size:11px;color:var(--muted);margin-bottom:2px;">Cost / hour</div>
            <div style="font-size:13px;font-weight:500;">${{ (vps.costPerHour ?? 0).toFixed(2) }}</div>
          </div>
          <div style="padding:8px 10px;background:var(--bg-sunk);border-radius:8px;">
            <div style="font-size:11px;color:var(--muted);margin-bottom:2px;">Uptime</div>
            <div style="font-size:13px;font-weight:500;">{{ vps.uptime || '—' }}</div>
          </div>
        </div>

        <div style="display:flex;gap:6px;">
          <button
            v-if="vps.status !== 'running'"
            class="nx-btn nx-btn-sm nx-btn-accent"
            :disabled="actingIds.has(vps.id)"
            @click="doAction(vps.id, 'start')"
          >
            <Play :size="12" /> Start
          </button>
          <button
            v-if="vps.status === 'running'"
            class="nx-btn nx-btn-sm nx-btn-soft"
            :disabled="actingIds.has(vps.id)"
            @click="doAction(vps.id, 'stop')"
          >
            <Square :size="12" /> Stop
          </button>
          <button
            class="nx-btn nx-btn-sm nx-btn-soft"
            :disabled="actingIds.has(vps.id)"
            @click="doAction(vps.id, 'restart')"
          >
            <RotateCcw :size="12" /> Restart
          </button>
          <button
            class="nx-btn nx-btn-sm nx-btn-ghost"
            style="color:var(--danger);"
            :disabled="actingIds.has(vps.id)"
            @click="doAction(vps.id, 'destroy')"
          >
            <Trash2 :size="12" /> Destroy
          </button>
        </div>
      </div>
    </div>

    <!-- Cost summary -->
    <div v-if="instances.length > 0" class="nx-surface" style="padding:18px;margin-top:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">
        <div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:2px;">Total cost this month</div>
          <div class="nx-h-title">${{ totalMonthlyCost.toFixed(2) }}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:2px;">Estimated daily cost</div>
          <div class="nx-h-heading">${{ estimatedDailyCost.toFixed(2) }}</div>
        </div>
        <div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:2px;">Active servers</div>
          <div class="nx-h-heading">{{ runningCount }} / {{ instances.length }}</div>
        </div>
      </div>
    </div>

    <!-- Provision modal -->
    <template v-if="provisionModal">
      <div class="nx-scrim" @click="provisionModal = false" />
      <div class="nx-modal" style="width:480px;">
        <div style="padding:14px 22px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div class="text-tiny" style="margin-bottom:2px;">Provision</div>
            <div class="nx-h-title">New Agent Server</div>
          </div>
          <button class="nx-icon-btn" @click="provisionModal = false"><X :size="16" /></button>
        </div>

        <div style="padding:22px;display:flex;flex-direction:column;gap:16px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:8px;">Region</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <button
                v-for="r in regions"
                :key="r.id"
                style="padding:12px;text-align:left;border-radius:10px;cursor:pointer;"
                :style="{ border: '1px solid ' + (provisionForm.region === r.id ? 'var(--accent)' : 'var(--line)'), background: provisionForm.region === r.id ? 'var(--accent-soft)' : 'var(--bg-elev)' }"
                @click="provisionForm.region = r.id"
              >
                <div style="font-size:13px;font-weight:600;">{{ r.label }}</div>
                <div style="font-size:11px;color:var(--muted);">{{ r.location }}</div>
              </button>
            </div>
          </div>

          <div>
            <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:8px;">Server size</label>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <button
                v-for="s in sizes"
                :key="s.id"
                style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;text-align:left;cursor:pointer;"
                :style="{ border: '1px solid ' + (provisionForm.size === s.id ? 'var(--accent)' : 'var(--line)'), background: provisionForm.size === s.id ? 'var(--accent-soft)' : 'var(--bg-elev)' }"
                @click="provisionForm.size = s.id"
              >
                <div style="flex:1;">
                  <div style="font-size:13.5px;font-weight:600;">{{ s.label }}</div>
                  <div style="font-size:12px;color:var(--muted);">{{ s.specs }}</div>
                </div>
                <div style="font-size:13px;font-weight:600;font-family:var(--font-mono);">${{ s.price }}/hr</div>
              </button>
            </div>
          </div>
        </div>

        <div style="padding:14px 22px;border-top:1px solid var(--line);display:flex;justify-content:space-between;">
          <button class="nx-btn nx-btn-ghost" @click="provisionModal = false">Cancel</button>
          <button
            class="nx-btn nx-btn-accent"
            :disabled="!provisionForm.region || !provisionForm.size || provisioning"
            @click="provisionServer"
          >
            <Server :size="13" /> {{ provisioning ? 'Provisioning…' : 'Provision Server' }}
          </button>
        </div>
      </div>
    </template>

  </div>
</template>

<script setup lang="ts">
import { Plus, Server, Play, Square, RotateCcw, Trash2, X } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const { currentWorkspaceId, ensureWorkspace } = useWorkspace()
const isLoading = ref(true)
const instances = ref<any[]>([])
const actingIds = ref(new Set<string>())

const provisionModal = ref(false)
const provisioning = ref(false)
const provisionForm = reactive({ region: '', size: '' })

const regions = [
  { id: 'fra1', label: 'Frankfurt', location: 'Germany' },
  { id: 'ams1', label: 'Amsterdam', location: 'Netherlands' },
  { id: 'lon1', label: 'London', location: 'United Kingdom' },
  { id: 'nyc1', label: 'New York', location: 'United States' },
]

const sizes = [
  { id: 's-1vcpu-2gb', label: 'Starter', specs: '1 vCPU · 2 GB · 50 GB SSD', price: 0.02 },
  { id: 's-2vcpu-4gb', label: 'Standard', specs: '2 vCPU · 4 GB · 80 GB SSD', price: 0.04 },
  { id: 's-4vcpu-8gb', label: 'Pro', specs: '4 vCPU · 8 GB · 160 GB SSD', price: 0.08 },
  { id: 's-8vcpu-16gb', label: 'Enterprise', specs: '8 vCPU · 16 GB · 320 GB SSD', price: 0.16 },
]

const runningCount = computed(() => instances.value.filter((v) => v.status === 'running').length)

const estimatedDailyCost = computed(() =>
  instances.value
    .filter((v) => v.status === 'running')
    .reduce((sum, v) => sum + (v.costPerHour ?? 0) * 24, 0)
)

const totalMonthlyCost = computed(() =>
  instances.value.reduce((sum, v) => sum + (v.costPerHour ?? 0) * 24 * 30, 0)
)

function statusColor (status: string): string {
  if (status === 'running') return 'var(--ok)'
  if (status === 'provisioning') return 'var(--warn)'
  if (status === 'stopped') return 'var(--muted)'
  if (status === 'error') return 'var(--danger)'
  return 'var(--muted)'
}

function statusTag (status: string): string {
  if (status === 'running') return 'ok'
  if (status === 'provisioning') return 'warn'
  if (status === 'error') return 'danger'
  return ''
}

async function fetchInstances () {
  isLoading.value = true
  try {
    const wsId = await ensureWorkspace()
    if (!wsId) return
    instances.value = await useApi<any[]>(`/workspaces/${wsId}/vps`)
  } catch {
    instances.value = []
  } finally {
    isLoading.value = false
  }
}

async function doAction (vpsId: string, action: string) {
  actingIds.value.add(vpsId)
  try {
    const wsId = await ensureWorkspace()
    if (!wsId) return
    await useApi(`/workspaces/${wsId}/vps/${vpsId}/actions`, {
      method: 'POST',
      body: { action },
    })
    await fetchInstances()
  } finally {
    actingIds.value.delete(vpsId)
  }
}

async function provisionServer () {
  provisioning.value = true
  try {
    const wsId = await ensureWorkspace()
    if (!wsId) return
    await useApi(`/workspaces/${wsId}/vps`, {
      method: 'POST',
      body: { region: provisionForm.region, size: provisionForm.size },
    })
    provisionModal.value = false
    provisionForm.region = ''
    provisionForm.size = ''
    await fetchInstances()
  } finally {
    provisioning.value = false
  }
}

onMounted(() => { void fetchInstances() })
</script>
