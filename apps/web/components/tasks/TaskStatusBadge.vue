<template>
  <UBadge
    variant="soft"
    :color="color"
    :class="sizeClass"
  >
    <component :is="icon" v-if="icon" class="mr-1 h-3 w-3" />
    {{ label }}
  </UBadge>
</template>

<script setup lang="ts">
import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  PauseCircle
} from 'lucide-vue-next'
import type { TaskStatus } from '~/types'

const props = defineProps<{
  status: TaskStatus
  size?: 'xs' | 'sm' | 'md'
}>()

const color = computed(() => {
  switch (props.status) {
    case 'pending': return 'amber'
    case 'in_progress': return 'blue'
    case 'done': return 'green'
    case 'cancelled': return 'red'
    default: return 'gray'
  }
})

const label = computed(() => {
  switch (props.status) {
    case 'pending': return 'Pending'
    case 'in_progress': return 'In Progress'
    case 'done': return 'Done'
    case 'cancelled': return 'Cancelled'
    default: return props.status
  }
})

const icon = computed(() => {
  switch (props.status) {
    case 'pending': return Clock
    case 'in_progress': return Loader2
    case 'done': return CheckCircle
    case 'cancelled': return XCircle
    default: return PauseCircle
  }
})

const sizeClass = computed(() => {
  switch (props.size) {
    case 'xs': return 'text-[10px] px-1.5 py-0.5'
    case 'sm': return 'text-xs px-2 py-0.5'
    default: return 'text-xs px-2.5 py-0.5'
  }
})
</script>
