<template>
  <div>
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-semibold">Team</h1>
        <p class="text-slate-500 mt-1">Manage workspace members and invitations.</p>
      </div>
      <UButton color="primary" icon="i-heroicons-user-plus" @click="showInvite = true">
        Invite Member
      </UButton>
    </div>

    <UCard>
      <UTable :rows="members" :columns="columns">
        <template #role-data="{ row }">
          <UBadge :color="roleColor(row.role)" size="xs">{{ row.role }}</UBadge>
        </template>
        <template #actions-data="{ row }">
          <UButton variant="ghost" color="gray" size="xs" icon="i-heroicons-ellipsis-horizontal" />
        </template>
      </UTable>
    </UCard>

    <!-- Invite Modal -->
    <UModal v-model="showInvite">
      <UCard class="w-full max-w-md">
        <template #header>
          <h3 class="text-lg font-semibold">Invite Team Member</h3>
        </template>

        <form class="space-y-4" @submit.prevent="sendInvite">
          <UFormGroup label="Email">
            <UInput v-model="inviteForm.email" type="email" placeholder="colleague@company.com" required />
          </UFormGroup>

          <UFormGroup label="Role">
            <USelect v-model="inviteForm.role" :options="roleOptions" />
          </UFormGroup>

          <div v-if="inviteLink" class="p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
            <p class="text-sm font-medium mb-1">Invite Link</p>
            <div class="flex items-center gap-2">
              <code class="text-xs break-all">{{ inviteLink }}</code>
              <UButton variant="ghost" size="xs" icon="i-heroicons-clipboard" @click="copyLink" />
            </div>
          </div>

          <div class="flex justify-end gap-3">
            <UButton variant="ghost" @click="showInvite = false">Close</UButton>
            <UButton type="submit" color="primary">Generate Link</UButton>
          </div>
        </form>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({ middleware: 'auth' })

const { members, fetchMembers, inviteMember } = useWorkspace()
const showInvite = ref(false)
const inviteLink = ref('')

const inviteForm = ref({
  email: '',
  role: 'member',
})

const roleOptions = [
  { label: 'Admin', value: 'admin' },
  { label: 'Manager', value: 'manager' },
  { label: 'Member', value: 'member' },
  { label: 'Viewer', value: 'viewer' },
]

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
  { key: 'actions', label: '' },
]

function roleColor(role: string) {
  const colors: Record<string, string> = {
    owner: 'indigo',
    admin: 'blue',
    manager: 'amber',
    member: 'gray',
    viewer: 'slate',
  }
  return colors[role] || 'gray'
}

onMounted(() => { void fetchMembers() })

async function sendInvite() {
  const res = await inviteMember(inviteForm.value)
  inviteLink.value = res.link
}

function copyLink() {
  navigator.clipboard.writeText(inviteLink.value)
  useToast().add({ title: 'Copied to clipboard', color: 'green' })
}
</script>
