import type { Task } from '~/types'

export function useTasks () {
  const store = useTasksStore()
  return {
    tasks: computed(() => store.filteredTasks),
    allTasks: computed(() => store.tasks),
    filter: computed({
      get: () => store.filter,
      set: (v) => { store.filter = v }
    }),
    isLoading: computed(() => store.isLoading),
    fetchTasks: store.fetchTasks,
    createTask: store.createTask,
    updateTask: store.updateTask,
    deleteTask: store.deleteTask,
    subscribe: store.subscribe,
    unsubscribe: store.unsubscribe
  }
}
