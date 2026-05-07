<template>
  <div class="mb-2 flex items-center gap-2">
    <Rocket class="h-4 w-4 text-indigo-500" />
    <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">{{ missionTitle }}</span>
  </div>
</template>

<script setup lang="ts">
import { Rocket } from 'lucide-vue-next'

defineProps<{
  missionTitle: string
}>()
</script>
