<template>
  <NuxtLink :to="item.to" class="nx-nav-link" :class="{ active: isActive }">
    <component :is="item.icon" :size="15" />
    <span>{{ item.label }}</span>
    <span v-if="item.badge" class="nx-badge">{{ item.badge }}</span>
  </NuxtLink>
</template>

<script setup lang="ts">
interface NavItemDef {
  to: string
  label: string
  icon: any
  badge?: number | null
}
const props = defineProps<{ item: NavItemDef; current: string }>()
const isActive = computed(() => {
  if (props.item.to === '/') return props.current === '/'
  return props.current.startsWith(props.item.to)
})
</script>
