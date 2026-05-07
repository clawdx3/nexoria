<template>
  <UCard class="transition hover:shadow-md">
    <div class="flex items-start gap-4">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
        <component :is="typeIcon" class="h-5 w-5 text-slate-500" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <UBadge color="amber" variant="soft" size="xs">pending</UBadge>
          <span class="text-xs text-slate-500">{{ dateText }}</span>
        </div>
        <h3 class="mt-1 truncate text-sm font-semibold">{{ approval.title }}</h3>
        <p v-if="approval.description" class="mt-1 line-clamp-2 text-xs text-slate-500">
          {{ approval.description }}
        </p>
        <div class="mt-2 flex items-center gap-2 text-xs text-slate-500">
          <UserCircle class="h-3 w-3" />
          <span>Requested by agent</span>
        </div>
      </div>
    </div>

    <div class="mt-4 flex items-center justify-end gap-2">
      <UButton size="xs" color="gray" variant="soft" @click="emit('open')">
        Preview
      </UButton>
      <ApprovalActions @approve="emit('approve')" @reject="emit('reject')" @edit="emit('edit')" />
    </div>
  </UCard>
</template>

<script setup lang="ts">
import {
  Mail,
  FileText,
  Image,
  Megaphone,
  UserCircle
} from 'lucide-vue-next'
import type { Approval } from '~/types'

const props = defineProps<{
  approval: Approval
}>()

const emit = defineEmits<{
  (e: 'open'): void
  (e: 'approve'): void
  (e: 'reject'): void
  (e: 'edit'): void
  (e: 'decided'): void
}>()

const typeIcon = computed(() => {
  switch (props.approval.type) {
    case 'draft': return FileText
    case 'spend': return Megaphone
    default: return FileText
  }
})

// Try to infer icon from metadata/subtype if available
const metadata = computed(() => {
  return props.approval.metadata || {}
})

const inferredIcon = computed(() => {
  const sub = metadata.value?.subtype as string
  if (sub === 'email') return Mail
  if (sub === 'social') return Image
  return typeIcon.value
})

const dateText = computed(() => {
  return new Date(props.approval.createdAt).toLocaleDateString()
})
</script>
