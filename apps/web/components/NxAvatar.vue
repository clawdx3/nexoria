<template>
  <span
    class="nx-av"
    :class="[sizeClass, clay && 'clay']"
    :style="colorStyle"
  >{{ initials }}</span>
</template>

<script setup lang="ts">
const props = defineProps<{
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  clay?: boolean
  color?: string
}>()

const initials = computed(() => {
  const n = props.name || '?'
  return n.split(/\s+/).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase()
})
const sizeClass = computed(() => {
  if (props.size === 'lg') return 'lg'
  if (props.size === 'xl') return 'xl'
  return ''
})
const colorStyle = computed(() => {
  if (props.color) return { background: props.color, color: '#fff', borderColor: 'transparent' }
  return {}
})
</script>
