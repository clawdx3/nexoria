<template>
  <div
    class="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
    :class="sizeClass"
    role="status"
    aria-label="Loading"
  >
    <span class="sr-only">Loading...</span>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'h-4 w-4'
    case 'lg': return 'h-8 w-8'
    default: return 'h-5 w-5'
  }
})
</script>
