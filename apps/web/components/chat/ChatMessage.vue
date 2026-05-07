<template>
  <div class="flex gap-3" :class="role === 'user' ? 'flex-row-reverse' : 'flex-row'">
    <div
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      :class="role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'"
    >
      <component :is="role === 'user' ? User : Bot" class="h-4 w-4" />
    </div>
    <div class="max-w-[80%]">
      <div
        v-if="agentName"
        class="mb-1 text-xs font-medium text-slate-500"
      >
        {{ agentName }}
      </div>
      <div
        class="rounded-2xl px-4 py-3 text-sm leading-relaxed"
        :class="role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'"
      >
        <div class="whitespace-pre-wrap">{{ content }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { User, Bot } from 'lucide-vue-next'

defineProps<{
  role: 'user' | 'assistant' | 'system'
  content: string
  agentName?: string | null
}>()
</script>
