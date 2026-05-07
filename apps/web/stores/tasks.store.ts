import { defineStore } from 'pinia'
import type { Task } from '~/types'

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

  function setTasks (list: Task[]): void {
    tasks.value = list
  }

  function appendTask (task: Task): void {
    tasks.value.unshift(task)
  }

  function updateTaskInList (id: string, patch: Partial<Task>): void {
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      tasks.value[idx] = { ...tasks.value[idx], ...patch }
    }
  }

  function removeTask (id: string): void {
    tasks.value = tasks.value.filter(t => t.id !== id)
  }

  return {
    tasks,
    filter,
    isLoading,
    filteredTasks,
    setTasks,
    appendTask,
    updateTaskInList,
    removeTask
  }
})
