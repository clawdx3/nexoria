<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
      <div>
        <h1 class="text-lg font-semibold">Approvals</h1>
        <p class="text-sm text-slate-500">Review and approve agent actions.</p>
      </div>
      <div class="flex items-center gap-2">
        <UBadge color="amber" variant="soft">{{ pendingApprovals.length }} pending</UBadge>
      </div>
    </div>
    <div class="flex-1 overflow-auto p-6">
      <CommonLoadingSpinner v-if="isLoading" />
      <div v-else-if="pendingApprovals.length === 0">
        <CommonEmptyState :icon="CheckCircle" title="All caught up"
          description="No pending approvals right now."
        />
      </div>
      <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ApprovalsApprovalCard
          v-for="a in pendingApprovals"
          :key="a.id"
          :approval="a"
          @open="openApproval(a)"
          @edit="openApproval(a)"
          @approve="approveApproval(a.id)"
          @reject="rejectApproval(a.id)"
          @decided="onDecided"
        />
      </div>
    </div>
    <ApprovalsApprovalPreview
      v-if="selectedApproval"
      v-model="isPreviewOpen"
      :approval="selectedApproval"
      @decided="onPreviewDecision"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
import { CheckCircle } from 'lucide-vue-next'

const { pendingApprovals, isLoading, fetchApprovals, approve, reject } = useApprovals()
const selectedApproval = ref<any | null>(null)
const isPreviewOpen = ref(false)
onMounted(() => { void fetchApprovals() })

// Polling for real-time feel
const { startPolling, stopPolling } = useRealtime()
onMounted(() => startPolling(() => fetchApprovals(), 10000))
onBeforeUnmount(() => stopPolling())

function openApproval (approval: any) {
  selectedApproval.value = approval
  isPreviewOpen.value = true
}

async function approveApproval (id: string, reason?: string) {
  await approve(id, reason)
  onDecided()
}

async function rejectApproval (id: string, reason?: string) {
  await reject(id, reason)
  onDecided()
}

async function onPreviewDecision (payload: { outcome: string; reason?: string; content?: string }) {
  if (!selectedApproval.value) return
  if (payload.outcome === 'approve') {
    await approveApproval(selectedApproval.value.id, payload.content || payload.reason)
  } else if (payload.outcome === 'reject') {
    await rejectApproval(selectedApproval.value.id, payload.reason)
  }
  selectedApproval.value = null
}

function onDecided () {
  useToast().add({ title: 'Decision recorded', color: 'green' })
}
</script>
