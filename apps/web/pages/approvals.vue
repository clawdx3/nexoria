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
        <EmptyState :icon="CheckCircle" title="All caught up"
          description="No pending approvals right now."
        />
      </div>
      <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ApprovalCard
          v-for="a in pendingApprovals"
          :key="a.id"
          :approval="a"
          @decided="onDecided"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
import { CheckCircle } from 'lucide-vue-next'

const { pendingApprovals, isLoading, fetchApprovals } = useApprovals()
onMounted(() => { void fetchApprovals() })

// Polling for real-time feel
const { startPolling, stopPolling } = useRealtime()
onMounted(() => startPolling(() => fetchApprovals(), 10000))
onBeforeUnmount(() => stopPolling())

function onDecided () {
  useToast().add({ title: 'Decision recorded', color: 'green' })
}
</script>
