<template>
  <div class="flex gap-3" :class="role === 'user' ? 'flex-row-reverse' : 'flex-row'">
    <div
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      :class="role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'"
    >
      <component :is="role === 'user' ? User : Bot" class="h-4 w-4" />
    </div>
    <div class="max-w-[80%]">
      <div
        v-if="agentName"
        class="mb-1 text-xs font-medium text-slate-500"
      >
        {{ agentName }}
      </div>
      <div
        class="rounded-2xl px-4 py-3 text-sm leading-relaxed"
        :class="role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'"
      >
        <div class="whitespace-pre-wrap">{{ content }}</div>
        <div v-if="attachments?.length" class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="attachment in attachments"
            :key="attachment.id"
            type="button"
            class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
            :class="role === 'user' ? 'border-indigo-300 bg-indigo-400/40 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'"
            @click="openAttachment(attachment.id)"
          >
            <Paperclip class="h-3 w-3" />
            {{ attachment.filename }}
          </button>
        </div>
        <div v-if="actionCard" class="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ actionCard.type }}</span>
                <span :class="['rounded px-1.5 py-0.5 text-[11px] font-medium', badgeClass]">{{ actionCard.status }}</span>
              </div>
              <div class="mt-1 text-sm font-semibold">{{ actionCard.title }}</div>
              <p v-if="actionCard.description" class="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                {{ actionCard.description }}
              </p>
              <p v-if="caption" class="mt-2 line-clamp-4 rounded border border-slate-100 bg-slate-50 p-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                {{ caption }}
              </p>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap justify-end gap-2">
            <UButton v-if="actionCard.type === 'approval' && actionCard.status === 'pending'" size="xs" color="green" :loading="isDeciding" @click="decideApproval('approve')">
              Approve
            </UButton>
            <UButton v-if="actionCard.type === 'approval' && actionCard.status === 'pending'" size="xs" color="red" variant="soft" :loading="isDeciding" @click="decideApproval('reject')">
              Reject
            </UButton>
            <UButton size="xs" color="gray" variant="soft" @click="openTarget">
              Review
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { User, Bot, Paperclip } from 'lucide-vue-next'
import type { Attachment, ChatActionCard } from '~/types'

const props = defineProps<{
  role: 'user' | 'assistant' | 'system'
  content: string
  agentName?: string | null
  actionCard?: ChatActionCard | null
  attachments?: Attachment[]
}>()

const isDeciding = ref(false)

const caption = computed(() => {
  if (props.actionCard?.type !== 'approval') return ''
  return props.actionCard.metadata?.caption as string || ''
})

const badgeClass = computed(() => {
  switch (props.actionCard?.status) {
    case 'approved':
    case 'done':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
    case 'rejected':
    case 'cancelled':
      return 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
    case 'in_progress':
      return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300'
    default:
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
  }
})

async function decideApproval (outcome: 'approve' | 'reject'): Promise<void> {
  if (!props.actionCard || props.actionCard.type !== 'approval') return
  isDeciding.value = true
  try {
    const { approve, reject } = useApprovals()
    if (outcome === 'approve') await approve(props.actionCard.id)
    else await reject(props.actionCard.id)
    props.actionCard.status = outcome === 'approve' ? 'approved' : 'rejected'
    useToast().add({ title: outcome === 'approve' ? 'Approval accepted' : 'Approval rejected', color: outcome === 'approve' ? 'green' : 'red' })
    await useTasksStore().fetchTasks()
  } finally {
    isDeciding.value = false
  }
}

function openTarget (): void {
  if (!props.actionCard) return
  void navigateTo(props.actionCard.type === 'approval' ? '/approvals' : '/tasks')
}

async function openAttachment (attachmentId: string): Promise<void> {
  const url = await useAttachments().downloadUrl(attachmentId)
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>
