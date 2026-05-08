<template>
  <UCard class="group transition hover:shadow-md">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3 class="truncate text-sm font-semibold">{{ task.title }}</h3>
          <TasksTaskStatusBadge :status="task.status" />
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

        <div v-if="runtimeStatus || runtimeOutputPreview || runtimeArtifactIds.length" class="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="font-medium text-slate-700 dark:text-slate-200">Runtime</span>
            <span v-if="runtimeStatus" :class="['rounded px-1.5 py-0.5 font-medium', runtimeStatusClass]">
              {{ runtimeStatusLabel }}
            </span>
          </div>
          <p v-if="runtimeOutputPreview" class="mt-2 line-clamp-3 text-xs leading-5 text-slate-500">
            {{ runtimeOutputPreview }}
          </p>
          <div v-if="runtimeArtifactIds.length" class="mt-2 flex flex-wrap gap-2">
            <a
              v-for="artifactId in runtimeArtifactIds"
              :key="artifactId"
              :href="artifactUrl(artifactId)"
              target="_blank"
              class="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
            >
              <Download class="h-3 w-3" />
              Result
            </a>
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
  Download
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
  return (props.task.metadata?.agentName as string)
    || (props.task.metadata?.handoffTargetAgentRole === 'content_creator' ? 'Content Creator' : '')
})

const runtimeStatus = computed(() => {
  const status = (props.task.metadata?.runtimeJobStatus as string) || (props.task.metadata?.handoffStatus as string) || ''
  return status === 'approved' ? 'completed' : status
})

const runtimeStatusLabel = computed(() => runtimeStatus.value.replace(/_/g, ' '))

const runtimeStatusClass = computed(() => {
  switch (runtimeStatus.value) {
    case 'completed':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
    case 'failed':
    case 'rejected':
    case 'cancelled':
    case 'runtime_dispatch_failed':
      return 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
    default:
      return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300'
  }
})

const runtimeOutputPreview = computed(() => props.task.metadata?.runtimeOutputPreview as string | undefined)

const runtimeArtifactIds = computed(() => {
  const ids = props.task.metadata?.runtimeArtifactIds
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
})

function artifactUrl (artifactId: string): string {
  return `/api/v1/workspaces/${props.task.workspaceId}/artifacts/${artifactId}/download`
}

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
      click: () => emit('update', props.task.id, { status: 'done' })
    },
    {
      label: 'Pause',
      click: () => emit('update', props.task.id, { status: 'pending' })
    },
    {
      label: 'Cancel',
      click: () => emit('update', props.task.id, { status: 'cancelled' })
    }
  ],
  [
    {
      label: 'Delete',
      click: () => emit('delete', props.task.id)
    }
  ]
])
</script>
