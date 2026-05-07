<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
navigateTo('/settings/profile', { replace: true })
</script>
