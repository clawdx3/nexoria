import { defineStore } from 'pinia'
import type { Task, CreateTaskPayload, UpdateTaskPayload } from '~/types'

export type TaskFilterStatus = 'all' | 'pending' | 'in_progress' | 'waiting_approval' | 'done'

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const filter = ref<TaskFilterStatus>('all')
  const isLoading = ref(false)

  const filteredTasks = computed(() => {
    if (filter.value === 'all') return tasks.value
    if (filter.value === 'waiting_approval') {
      return tasks.value.filter(
        t => t.status === 'in_progress' && (t.metadata?.waitingApproval || false)
      )
    }
    return tasks.value.filter(t => t.status === filter.value)
  })

  // --- API Methods ---

  async function fetchTasks (wsId?: string): Promise<void> {
    const workspaceId = wsId || useCookie('workspace_id').value
    if (!workspaceId) return
    isLoading.value = true
    try {
      const res = await useApi<{ tasks: Task[] }>(`/workspaces/${workspaceId}/tasks`)
      tasks.value = res.tasks || []
    } finally {
      isLoading.value = false
    }
  }

  async function createTask (payload: CreateTaskPayload & { workspaceId?: string }): Promise<Task> {
    const workspaceId = payload.workspaceId || useCookie('workspace_id').value
    if (!workspaceId) throw new Error('No workspace selected')
    const res = await useApi<{ task: Task }>(`/workspaces/${workspaceId}/tasks`, {
      method: 'POST',
      body: payload
    })
    tasks.value.unshift(res.task)
    return res.task
  }

  async function updateTask (id: string, payload: UpdateTaskPayload & { workspaceId?: string }): Promise<Task> {
    const workspaceId = payload.workspaceId || useCookie('workspace_id').value
    if (!workspaceId) throw new Error('No workspace selected')
    const res = await useApi<{ task: Task }>(`/workspaces/${workspaceId}/tasks/${id}`, {
      method: 'PATCH',
      body: payload
    })
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      tasks.value[idx] = { ...tasks.value[idx], ...res.task }
    }
    return res.task
  }

  async function deleteTask (id: string, workspaceId?: string): Promise<void> {
    const wsId = workspaceId || useCookie('workspace_id').value
    if (!wsId) throw new Error('No workspace selected')
    await useApi(`/workspaces/${wsId}/tasks/${id}`, { method: 'DELETE' })
    tasks.value = tasks.value.filter(t => t.id !== id)
  }

  return {
    tasks,
    filter,
    isLoading,
    filteredTasks,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask
  }
})
