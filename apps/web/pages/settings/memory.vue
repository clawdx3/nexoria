<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-semibold">AI Learning</h1>
      <p class="text-slate-500 mt-1">Review what your AI has learned. Approve, reject, or edit memories.</p>
    </div>

    <div class="space-y-4">
      <UCard v-for="memory in memories" :key="memory.id">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <UBadge :color="badgeColor(memory.type)" size="xs">{{ memory.type }}</UBadge>
              <span class="text-xs text-slate-400">{{ formatDate(memory.createdAt) }}</span>
              <span class="text-xs text-slate-400">Confidence: {{ Math.round(memory.confidence * 100) }}%</span>
            </div>
            <p class="text-sm">{{ memory.content }}</p>
          </div>

          <div class="flex items-center gap-1">
            <UButton variant="ghost" color="green" size="xs" icon="i-heroicons-check" @click="approve(memory.id)" />
            <UButton variant="ghost" color="red" size="xs" icon="i-heroicons-x-mark" @click="reject(memory.id)" />
            <UButton variant="ghost" color="gray" size="xs" icon="i-heroicons-pencil" @click="edit(memory)" />
          </div>
        </div>
      </UCard>

      <EmptyState
        v-if="memories.length === 0"
        icon="Brain"
        title="No memories yet"
        description="Memories will appear here after your AI agents complete tasks and learn patterns."
      />
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { memories, fetchMemories, updateMemory } = useMemory()

function badgeColor(type: string) {
  const colors: Record<string, string> = {
    preference: 'indigo',
    avoidance: 'red',
    fact: 'blue',
    pattern: 'amber',
    task_result: 'green',
    draft: 'purple',
  }
  return colors[type] || 'gray'
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString()
}

async function approve(id: string) {
  await updateMemory(id, { confidence: 1 })
  await fetchMemories()
}

async function reject(id: string) {
  await updateMemory(id, { confidence: 0 })
  await fetchMemories()
}

async function edit(memory: any) {
  const newContent = prompt('Edit memory:', memory.content)
  if (newContent) {
    await updateMemory(memory.id, { content: newContent })
    await fetchMemories()
  }
}

onMounted(() => { void fetchMemories() })
</script>
