<template>
  <UCard class="group transition hover:shadow-md">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3 class="truncate text-sm font-semibold">{{ task.title }}</h3>
          <TaskStatusBadge :status="task.status" />
        </div>
        <p v-if="task.description" class="mt-1 line-clamp-2 text-xs text-slate-500">
          {{ task.description }}
        </p>

        <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <div v-if="assignedAgent" class="flex items-center gap-1">
            <Bot class="h-3 w-3" />
            <span>{{ assignedAgent }}</span>
          </div>
          <div class="flex items-center gap-1">
            <Clock class="h-3 w-3" />
            <span>{{ formattedDate }}</span>
          </div>
          <div v-if="task.priority !== 'medium'" class="flex items-center gap-1">
            <AlertTriangle v-if="task.priority === 'high' || task.priority === 'urgent'" class="h-3 w-3 text-amber-500" />
            <span :class="priorityClass">{{ task.priority }}</span>
          </div>
        </div>
      </div>

      <UDropdown :items="actionItems">
        <UButton variant="ghost" color="gray" size="xs" square>
          <MoreHorizontal class="h-4 w-4" />
        </UButton>
      </UDropdown>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import {
  Bot,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  PauseCircle
} from 'lucide-vue-next'
import type { Task } from '~/types'

const props = defineProps<{
  task: Task
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'update', id: string, patch: Partial<Task>): void
  (e: 'delete', id: string): void
}>()

const assignedAgent = computed(() => {
  return (props.task.metadata?.agentName as string) || ''
})

const formattedDate = computed(() => {
  return new Date(props.task.createdAt).toLocaleDateString()
})

const priorityClass = computed(() => {
  switch (props.task.priority) {
    case 'high': return 'text-amber-500 font-medium'
    case 'urgent': return 'text-red-500 font-medium'
    default: return 'text-slate-500'
  }
})

const actionItems = computed(() => [
  [
    {
      label: 'Mark done',
      icon: CheckCircle,
      click: () => emit('update', props.task.id, { status: 'done' })
    },
    {
      label: 'Pause',
      icon: PauseCircle,
      click: () => emit('update', props.task.id, { status: 'pending' })
    },
    {
      label: 'Cancel',
      icon: XCircle,
      click: () => emit('update', props.task.id, { status: 'cancelled' })
    }
  ],
  [
    {
      label: 'Delete',
      icon: XCircle,
      click: () => emit('delete', props.task.id)
    }
  ]
])
</script>
