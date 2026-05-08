<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-semibold">Playbooks</h1>
      <p class="text-slate-500 mt-1">Reusable workflows learned from successful missions.</p>
    </div>
    <CommonEmptyState icon="FileText" title="No playbooks yet" description="Playbooks are created automatically when your AI completes multi-step missions." />
  </div>
</template>
<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
</script>
