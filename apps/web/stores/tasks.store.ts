import { defineStore } from 'pinia'
import type { Task, CreateTaskPayload, UpdateTaskPayload } from '~/types'

export type TaskFilterStatus = 'all' | 'pending' | 'in_progress' | 'waiting_approval' | 'done'

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const filter = ref<TaskFilterStatus>('all')
  const isLoading = ref(false)
  const eventsAbort = ref<AbortController | null>(null)

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
    const workspaceId = wsId || await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId) return
    isLoading.value = true
    try {
      const res = await useApi<Task[]>(`/workspaces/${workspaceId}/tasks`)
      tasks.value = res || []
    } finally {
      isLoading.value = false
    }
  }

  async function createTask (payload: CreateTaskPayload & { workspaceId?: string }): Promise<Task> {
    const workspaceId = payload.workspaceId || await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId) throw new Error('No workspace selected')
    const res = await useApi<Task>(`/workspaces/${workspaceId}/tasks`, {
      method: 'POST',
      body: payload
    })
    tasks.value.unshift(res)
    return res
  }

  async function updateTask (id: string, payload: UpdateTaskPayload & { workspaceId?: string }): Promise<Task> {
    const workspaceId = payload.workspaceId || await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId) throw new Error('No workspace selected')
    const res = await useApi<Task>(`/workspaces/${workspaceId}/tasks/${id}`, {
      method: 'PATCH',
      body: payload
    })
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      tasks.value[idx] = { ...tasks.value[idx], ...res }
    }
    return res
  }

  async function deleteTask (id: string, workspaceId?: string): Promise<void> {
    const wsId = workspaceId || await useWorkspaceStore().ensureWorkspace()
    if (!wsId) throw new Error('No workspace selected')
    await useApi(`/workspaces/${wsId}/tasks/${id}`, { method: 'DELETE' })
    tasks.value = tasks.value.filter(t => t.id !== id)
  }

  function applyEvent (event: { type: string; task?: Task; taskId?: string }): void {
    if ((event.type === 'task.created' || event.type === 'task.updated') && event.task) {
      const idx = tasks.value.findIndex(t => t.id === event.task!.id)
      if (idx === -1) tasks.value.unshift(event.task)
      else tasks.value[idx] = { ...tasks.value[idx], ...event.task }
      return
    }
    if (event.type === 'task.deleted' && event.taskId) {
      tasks.value = tasks.value.filter(t => t.id !== event.taskId)
    }
  }

  async function subscribe (wsId?: string): Promise<void> {
    if (eventsAbort.value) return
    const workspaceId = wsId || await useWorkspaceStore().ensureWorkspace()
    if (!workspaceId) return
    const controller = new AbortController()
    eventsAbort.value = controller
    void readEvents(workspaceId, controller)
  }

  function unsubscribe (): void {
    eventsAbort.value?.abort()
    eventsAbort.value = null
  }

  async function readEvents (workspaceId: string, controller: AbortController): Promise<void> {
    try {
      const response = await useApiStream(`/workspaces/${workspaceId}/tasks/events`, {
        signal: controller.signal,
        headers: { Accept: 'text/event-stream' }
      })
      if (!response.ok || !response.body) throw new Error(`tasks stream failed (${response.status})`)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (!controller.signal.aborted) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() || ''
        for (const chunk of chunks) {
          const dataLine = chunk.split('\n').find(line => line.startsWith('data:'))
          if (!dataLine) continue
          try { applyEvent(JSON.parse(dataLine.replace(/^data:\s*/, ''))) } catch { /* ignore malformed */ }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) console.warn('[tasks] stream disconnected', err)
    } finally {
      if (eventsAbort.value === controller) eventsAbort.value = null
    }
  }

  return {
    tasks,
    filter,
    isLoading,
    filteredTasks,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    subscribe,
    unsubscribe
  }
})
