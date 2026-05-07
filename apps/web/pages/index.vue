<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
      <div>
        <h1 class="text-lg font-semibold">Team Lead</h1>
        <p class="text-sm text-slate-500">Ask anything. The orchestrator will delegate to the right agent.</p>
      </div>
    </div>
    <ChatWindow agent-role="orchestrator" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
</script>
