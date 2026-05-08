<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-semibold">AI Agents</h1>
      <p class="text-slate-500 mt-1">Configure your AI assistants.</p>
    </div>
    <UCard v-for="agent in agents" :key="agent.id" class="mb-4">
      <div class="flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-semibold">{{ agent.name }}</h3>
            <UBadge v-if="agent.isBuiltIn" color="cyan" variant="soft">Built-in</UBadge>
            <UBadge :color="agent.isEnabled === false ? 'gray' : 'green'" variant="soft">
              {{ agent.isEnabled === false ? 'Disabled' : 'Enabled' }}
            </UBadge>
          </div>
          <p class="text-sm text-slate-500">{{ agent.description }}</p>
          <p class="text-xs text-slate-400 mt-1">{{ agent.modelProvider }} / {{ agent.modelName }}</p>
        </div>
        <div class="flex items-center gap-3">
          <UBadge>{{ agent.role }}</UBadge>
          <UToggle
            :model-value="agent.isEnabled !== false"
            @update:model-value="(value) => toggleAgent(agent.id, value)"
          />
        </div>
      </div>
    </UCard>
  </div>
</template>
<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { agents, fetchAgents, updateAgent } = useAgent()
onMounted(() => { void fetchAgents() })

async function toggleAgent (id: string, isEnabled: boolean) {
  await updateAgent(id, { isEnabled })
}
</script>
