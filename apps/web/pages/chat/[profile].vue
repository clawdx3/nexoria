<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
      <Bot class="h-6 w-6 text-indigo-500" />
      <div>
        <h1 class="text-lg font-semibold">Team Lead</h1>
        <p class="text-sm text-slate-500">
          Delegates to {{ agent?.name || 'the selected agent' }} when work should move.
        </p>
      </div>
    </div>
    <ChatWindow />
  </div>
</template>

<script setup lang="ts">
import { Bot } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })
const route = useRoute()
const { agents, fetchAgents, isLoading } = useAgent()

onMounted(() => { void fetchAgents() })

const agent = computed(() => agents.value.find(a => a.id === route.params.profile))
</script>
