<template>
  <UModal v-model="isOpen" prevent-close>
    <UCard class="w-full max-w-4xl">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <component :is="typeIcon" class="h-5 w-5 text-slate-500" />
            <span class="font-semibold">{{ approval.title }}</span>
          </div>
          <UButton color="gray" variant="ghost" size="xs" @click="isOpen = false">
            <X class="h-4 w-4" />
          </UButton>
        </div>
      </template>

      <div class="grid gap-6 md:grid-cols-2">
        <!-- Left: Preview -->
        <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div v-if="isSocialPost" class="space-y-3">
            <div v-if="imageUrl" class="overflow-hidden rounded-lg">
              <img :src="imageUrl" alt="Post image" class="h-auto w-full object-cover" />
            </div>
            <p class="text-sm text-slate-700 dark:text-slate-200">{{ caption }}</p>
          </div>

          <div v-else-if="isEmail" class="space-y-3">
            <div>
              <label class="text-xs font-medium text-slate-500">To</label>
              <div class="text-sm">{{ toEmail }}</div>
            </div>
            <div>
              <label class="text-xs font-medium text-slate-500">Subject</label>
              <div class="text-sm font-semibold">{{ subject }}</div>
            </div>
            <div class="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
              <pre class="whitespace-pre-wrap">{{ body }}</pre>
            </div>
          </div>

          <div v-else class="text-sm text-slate-500">
            <pre class="whitespace-pre-wrap">{{ rawMetadata }}</pre>
          </div>
        </div>

        <!-- Right: Actions -->
        <div class="space-y-4">
          <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <p class="text-sm text-slate-500">Review the content and choose an action.</p>
          </div>

          <div v-if="showInlineEdit" class="space-y-2">
            <UTextarea
              v-model="editContent"
              :rows="6"
              class="text-sm"
            />
            <div class="flex flex-wrap gap-2">
              <UButton size="sm" color="indigo" @click="onEditApprove">Save & Approve</UButton>
              <UButton size="sm" color="gray" variant="soft" @click="showInlineEdit = false">Cancel</UButton>
            </div>
          </div>

          <div v-else class="space-y-3">
            <UTextarea
              v-model="rejectReason"
              placeholder="Add a comment (optional)"
              :rows="3"
              class="text-sm"
            />
            <div class="flex flex-wrap gap-2">
              <UButton size="sm" color="green" variant="soft" @click="onApprove">Approve</UButton>
              <UButton size="sm" color="gray" variant="soft" @click="showInlineEdit = true">Edit & Approve</UButton>
              <UButton size="sm" color="red" variant="soft" @click="onReject">Reject</UButton>
            </div>
          </div>
        </div>
      </div>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
import {
  Mail,
  FileText,
  Image,
  Megaphone,
  X
} from 'lucide-vue-next'
import type { Approval } from '~/types'

const props = defineProps<{
  approval: Approval
}>()

const emit = defineEmits<{
  (e: 'decided', payload: { outcome: string; reason?: string; content?: string }): void
}>()

const isOpen = defineModel<boolean>({ default: false })
const rejectReason = ref('')
const showInlineEdit = ref(false)
const editContent = ref('')

onMounted(() => {
  editContent.value = JSON.stringify(props.approval.metadata || {}, null, 2)
})

const meta = computed(() => props.approval.metadata || {})
const isSocialPost = computed(() => meta.value?.subtype === 'social')
const isEmail = computed(() => meta.value?.subtype === 'email')

const imageUrl = computed(() => meta.value?.imageUrl as string)
const caption = computed(() => meta.value?.caption as string)
const toEmail = computed(() => meta.value?.to as string)
const subject = computed(() => meta.value?.subject as string)
const body = computed(() => meta.value?.body as string)
const rawMetadata = computed(() => JSON.stringify(meta.value, null, 2))

const typeIcon = computed(() => {
  switch (props.approval.type) {
    case 'draft':
      return (meta.value?.subtype as string) === 'email'
        ? Mail
        : ((meta.value?.subtype as string) === 'social'
            ? Image
            : FileText)
    case 'spend': return Megaphone
    default: return FileText
  }
})

function onApprove () {
  emit('decided', { outcome: 'approved' })
  isOpen.value = false
}

function onReject () {
  emit('decided', { outcome: 'rejected', reason: rejectReason.value })
  isOpen.value = false
}

function onEditApprove () {
  emit('decided', { outcome: 'approved', content: editContent.value })
  showInlineEdit.value = false
  isOpen.value = false
}
</script>
