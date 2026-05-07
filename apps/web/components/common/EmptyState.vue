<template>
  <div class="flex items-center justify-center py-12">
    <div class="text-center">
      <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
        <component :is="icon" class="h-8 w-8 text-slate-400" />
      </div>
      <h3 class="text-lg font-semibold">{{ title }}</h3>
      <p class="mt-1 text-sm text-slate-500">{{ description }}</p>
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon: Component
  title: string
  description: string
}>()
</script>
