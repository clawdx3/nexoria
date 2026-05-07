<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-semibold">Team</h1>
      <p class="text-slate-500 mt-1">Manage workspace members and invitations.</p>
    </div>
    <UCard>
      <UTable :rows="members || []" :columns="[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' }]" />
    </UCard>
  </div>
</template>
<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { members, fetchMembers } = useWorkspace()
onMounted(() => { void fetchMembers() })
</script>
