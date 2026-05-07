<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
      <div>
        <h1 class="text-lg font-semibold">Tasks</h1>
        <p class="text-sm text-slate-500">Track work and missions across your team.</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton size="sm" color="indigo" @click="showCreate = true">
          <Plus class="h-4 w-4" />
          New task
        </UButton>
      </div>
    </div>

    <div class="flex items-center gap-2 border-b border-slate-200 px-6 py-3 dark:border-slate-800">
      <UButton
        v-for="tab in tabs"
        :key="tab.value"
        size="xs"
        :color="filter === tab.value ? 'indigo' : 'gray'"
        variant="soft"
        @click="setFilter(tab.value)"
      >
        {{ tab.label }}
      </UButton>
    </div>

    <div class="flex-1 overflow-auto p-6">
      <CommonLoadingSpinner v-if="isLoading" />
      <div v-else-if="tasks.length === 0">
        <EmptyState :icon="CheckCircle" title="No tasks yet" description="Create your first task to get started.">
          <template #action>
            <UButton size="sm" color="indigo" class="mt-4" @click="showCreate = true">Create task</UButton>
          </template>
        </EmptyState>
      </div>
      <div v-else class="space-y-4">
        <div v-for="(group, mission) in grouped" :key="mission">
          <div v-if="mission !== '_'" class="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            {{ mission }}
          </div>
          <div class="grid gap-3">
            <TaskCard v-for="task in group" :key="task.id" :task="task" @refresh="fetch" />
          </div>
        </div>
      </div>
    </div>

    <UModal v-model="showCreate">
      <div class="p-6 space-y-4">
        <h2 class="text-lg font-semibold">Create task</h2>
        <UFormGroup label="Title">
          <UInput v-model="createForm.title" placeholder="Task title" />
        </UFormGroup>
        <UFormGroup label="Description">
          <UTextarea v-model="createForm.description" placeholder="Description" />
        </UFormGroup>
        <div class="flex justify-end gap-2">
          <UButton color="gray" @click="showCreate = false">Cancel</UButton>
          <UButton color="indigo" :loading="creating" @click="submitCreate">Create</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
import { Plus, CheckCircle } from 'lucide-vue-next'
import type { Task } from '~/types'

const { tasks, isLoading, fetchTasks, createTask, filter } = useTasks()
const { fetchAgents } = useAgent()
onMounted(() => { void fetchTasks(); void fetchAgents() })

function setFilter (v: string) {
  filter.value = v as any
}

const tabs = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Done', value: 'done' }
]

const grouped = computed(() => {
  const map: Record<string, Task[]> = {}
  for (const t of tasks.value) {
    const key = (t.metadata?.missionName as string) || '_'
    if (!map[key]) map[key] = []
    map[key].push(t)
  }
  return map
})

const showCreate = ref(false)
const creating = ref(false)
const createForm = reactive({ title: '', description: '' })

async function submitCreate () {
  creating.value = true
  try {
    await createTask({ title: createForm.title, description: createForm.description })
    showCreate.value = false
    Object.assign(createForm, { title: '', description: '' })
  } finally {
    creating.value = false
  }
}
</script>
