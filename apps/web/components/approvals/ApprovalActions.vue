<template>
  <div class="flex items-center gap-2">
    <UButton size="xs" color="green" variant="soft" @click="emit('approve')">
      Approve
    </UButton>
    <UButton size="xs" color="gray" variant="soft" @click="emit('edit')">
      <Pencil class="mr-1 h-3 w-3" /> Edit
    </UButton>
    <UButton size="xs" color="red" variant="soft" @click="emit('reject')">
      Reject
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { Pencil } from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'approve'): void
  (e: 'reject'): void
  (e: 'edit'): void
}>()
</script>
