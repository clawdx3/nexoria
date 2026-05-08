<template>
  <div class="nx-page-wide">

    <!-- Page header -->
    <div style="margin-bottom:24px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <div class="text-tiny" style="margin-bottom:6px;">Review</div>
        <div class="nx-h-display">Approvals</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px;max-width:580px;">What your agents want to do next. You decide.</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <span v-if="pendingApprovals.length > 0" class="nx-tag warn">{{ pendingApprovals.length }} pending</span>
        <button class="nx-btn nx-btn-soft nx-btn-sm" @click="fetchApprovals()">
          <RefreshCw :size="13" /> Refresh
        </button>
      </div>
    </div>

    <div v-if="isLoading" style="padding:40px;text-align:center;color:var(--muted);font-size:13px;">Loading…</div>

    <div v-else-if="pendingApprovals.length === 0" style="padding:64px;text-align:center;">
      <div style="width:44px;height:44px;border-radius:12px;background:var(--bg-sunk);display:inline-flex;align-items:center;justify-content:center;color:var(--muted);margin-bottom:12px;">
        <CheckCircle :size="20" />
      </div>
      <div class="nx-h-heading" style="margin-bottom:4px;">All caught up</div>
      <div style="font-size:13px;color:var(--muted);">No pending approvals right now.</div>
    </div>

    <div v-else style="display:grid;grid-template-columns:minmax(0,1fr) 460px;gap:18px;">

      <!-- Queue -->
      <div class="nx-surface" style="overflow:hidden;">
        <button
          v-for="(a, i) in pendingApprovals"
          :key="a.id"
          style="display:block;width:100%;text-align:left;padding:16px 18px;transition:background .12s;"
          :style="{
            borderLeft: a.id === selected ? '3px solid var(--accent)' : '3px solid transparent',
            borderBottom: i < pendingApprovals.length - 1 ? '1px solid var(--line)' : 'none',
            background: a.id === selected ? 'var(--bg-sunk)' : 'transparent',
          }"
          @click="selected = a.id"
        >
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <NxAvatar :name="a.metadata?.agentName || 'Agent'" :color="agentColor(a)" />
            <span style="font-size:13px;font-weight:600;">{{ a.metadata?.agentName || 'Agent' }}</span>
            <span class="nx-tag" :class="riskTone(a)">{{ riskLabel(a) }}</span>
            <span style="margin-left:auto;font-size:11px;color:var(--muted);">{{ formatTime(a.createdAt) }}</span>
          </div>
          <div style="font-size:14px;font-weight:500;margin-bottom:4px;">{{ a.title }}</div>
          <div style="font-size:12px;color:var(--muted);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">{{ a.description }}</div>
        </button>
      </div>

      <!-- Preview panel -->
      <div v-if="selectedApproval" class="nx-surface" style="position:sticky;top:80px;align-self:start;overflow:hidden;">
        <div style="padding:18px;border-bottom:1px solid var(--line);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <NxAvatar :name="selectedApproval.metadata?.agentName || 'Agent'" :color="agentColor(selectedApproval)" size="lg" />
            <div>
              <div class="text-tiny" style="color:var(--muted);">{{ selectedApproval.type || 'Approval' }}</div>
              <div class="nx-h-heading">{{ selectedApproval.title }}</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--muted);">{{ formatTime(selectedApproval.createdAt) }}</div>
        </div>

        <div style="padding:18px;">
          <div style="padding:14px;background:var(--bg-sunk);border-radius:10px;font-size:13.5px;line-height:1.65;white-space:pre-wrap;">{{ selectedApproval.description }}</div>
        </div>

        <!-- Edit area -->
        <div style="padding:0 18px 14px;">
          <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">Reason / notes (optional)</label>
          <textarea v-model="decisionNote" class="nx-input" rows="2" placeholder="Add a note…" />
        </div>

        <div style="padding:14px;border-top:1px solid var(--line);display:flex;gap:8px;">
          <button class="nx-btn nx-btn-ghost" style="flex:1;" @click="decide('reject')">
            <X :size="13" /> Reject
          </button>
          <button class="nx-btn nx-btn-soft" style="flex:1;" @click="decide('edit')">
            <Edit :size="13" /> Edit & approve
          </button>
          <button class="nx-btn nx-btn-accent" style="flex:1;" :disabled="deciding" @click="decide('approve')">
            <Check :size="13" /> {{ deciding ? 'Approving…' : 'Approve' }}
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { RefreshCw, CheckCircle, X, Edit, Check } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const { pendingApprovals, isLoading, fetchApprovals, approve, reject } = useApprovals()

onMounted(() => { void fetchApprovals() })
const { startPolling, stopPolling } = useRealtime()
onMounted(() => startPolling(() => fetchApprovals(), 10000))
onBeforeUnmount(() => stopPolling())

const selected = ref<string | null>(null)
const decisionNote = ref('')
const deciding = ref(false)

watch(pendingApprovals, (arr) => {
  if (arr.length > 0 && !selected.value) selected.value = arr[0].id
}, { immediate: true })

const selectedApproval = computed(() => pendingApprovals.value.find((a: any) => a.id === selected.value) || null)

const agentColorPalette = ['#C25B3F', '#7C5CC2', '#3F8FC2', '#5C9C6E']
function agentColor (a: any): string {
  if (a.metadata?.agentColor) return a.metadata.agentColor
  const idx = ((a.metadata?.agentName as string) || '').charCodeAt(0) % agentColorPalette.length
  return agentColorPalette[idx]
}

function riskTone (a: any): string {
  const t = (a.metadata?.riskLevel || 1)
  if (t >= 3) return 'danger'
  if (t === 2) return 'warn'
  return 'info'
}

function riskLabel (a: any): string {
  const t = (a.metadata?.riskLevel || 1)
  return `Risk ${t}`
}

function formatTime (d: string) {
  try {
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return d }
}

async function decide (action: 'approve' | 'reject' | 'edit') {
  if (!selectedApproval.value) return
  deciding.value = true
  try {
    if (action === 'reject') {
      await reject(selectedApproval.value.id, decisionNote.value)
      useToast().add({ title: 'Rejected', color: 'red' })
    } else {
      await approve(selectedApproval.value.id, decisionNote.value)
      useToast().add({ title: 'Approved', color: 'green' })
    }
    decisionNote.value = ''
    selected.value = pendingApprovals.value[0]?.id || null
  } finally {
    deciding.value = false
  }
}
</script>
