<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-semibold">Playbooks</h1>
      <p class="text-slate-500 mt-1">Reusable workflows your AI has learned from successful missions.</p>
    </div>

    <div class="space-y-4">
      <UCard v-for="book in playbooks" :key="book.id">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-3">
            <FileText class="h-5 w-5 text-slate-400 mt-0.5" />
            <div>
              <h3 class="font-semibold">{{ book.name }}</h3>
              <p class="text-sm text-slate-500">{{ book.description }}</p>
              <div class="flex items-center gap-4 mt-2 text-xs text-slate-400">
                <span class="flex items-center gap-1">
                  <Zap class="h-3.5 w-3.5" /> {{ book.usageCount }} uses
                </span>
                <span class="flex items-center gap-1">
                  <Clock class="h-3.5 w-3.5" /> {{ formatDate(book.createdAt) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <EmptyState
        v-if="playbooks.length === 0"
        icon="FileText"
        title="No playbooks yet"
        description="Playbooks are created automatically when your AI completes multi-step missions successfully."
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { FileText, Clock, Zap } from 'lucide-vue-next'
import { ref } from 'vue'

definePageMeta({ middleware: 'auth' })

const playbooks = ref<any[]>([])

function formatDate(date: string) {
  return new Date(date).toLocaleDateString()
}
</script>
