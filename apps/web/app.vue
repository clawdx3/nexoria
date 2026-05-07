<template>
  <AppLayout>
    <NuxtPage />
  </AppLayout>
</template>

<script setup lang="ts">
useHead({
  titleTemplate: (title) => (title ? `${title} — Nexoria` : 'Nexoria')
})
</script>