<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-semibold">AI Agents</h1>
      <p class="text-slate-500 mt-1">Configure your AI assistants.</p>
    </div>
    <UCard v-for="agent in agents" :key="agent.id" class="mb-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-semibold">{{ agent.name }}</h3>
          <p class="text-sm text-slate-500">{{ agent.description }}</p>
          <p class="text-xs text-slate-400 mt-1">{{ agent.modelProvider }} / {{ agent.modelName }}</p>
        </div>
        <UBadge>{{ agent.role }}</UBadge>
      </div>
    </UCard>
  </div>
</template>
<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { agents, fetchAgents } = useAgent()
onMounted(() => { void fetchAgents() })
</script>
