<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-semibold">AI Learning</h1>
      <p class="text-slate-500 mt-1">Review what your AI has learned.</p>
    </div>
    <UCard v-for="m in memories" :key="m.id" class="mb-3">
      <div class="flex items-start justify-between">
        <div>
          <UBadge size="xs" class="mb-2">{{ m.type }}</UBadge>
          <p class="text-sm">{{ m.content }}</p>
          <p class="text-xs text-slate-400 mt-1">Confidence: {{ Math.round(m.confidence * 100) }}%</p>
        </div>
      </div>
    </UCard>
    <EmptyState v-if="memories.length === 0" icon="Brain" title="No memories yet" description="Memories will appear here after your AI agents learn from tasks." />
  </div>
</template>
<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { memories, fetchMemories } = useMemory()
onMounted(() => { void fetchMemories() })
</script>
