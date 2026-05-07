<template>
  <div class="max-w-4xl space-y-6">
    <div>
      <h2 class="text-xl font-semibold">Business Profile</h2>
      <p class="text-sm text-slate-500">How Nexoria represents your brand.</p>
    </div>

    <UForm :state="form" class="space-y-4" @submit="onSubmit">
      <UFormGroup label="Business name" name="businessName">
        <UInput v-model="form.businessName" placeholder="Acme Corp" />
      </UFormGroup>

      <UFormGroup label="Tone of voice" name="toneOfVoice">
        <UTextarea v-model="form.toneOfVoice" :rows="4" placeholder="Professional, friendly, concise..." />
      </UFormGroup>

      <UFormGroup label="Brand rules" name="brandRules">
        <UTextarea v-model="form.brandRules" :rows="3" placeholder="Always include logo, use Oxford comma..." />
      </UFormGroup>

      <UFormGroup label="Languages" name="languages">
        <USelectMenu
          v-model="form.languages"
          :options="languageOptions"
          multiple
          searchable
          placeholder="Select languages"
        />
      </UFormGroup>

      <div class="grid grid-cols-2 gap-4">
        <UFormGroup label="Opening hours" name="openingHours">
          <UInput v-model="form.openingHours" placeholder="Mon-Fri 9:00-18:00" />
        </UFormGroup>
      </div>

      <UFormGroup label="Target customers" name="targetCustomers">
        <UTextarea v-model="form.targetCustomers" :rows="3" placeholder="Small business owners, age 25-45..." />
      </UFormGroup>

      <UFormGroup label="Do-not-say rules" name="doNotSayRules">
        <UTextarea v-model="form.doNotSayRules" :rows="3" placeholder="Never call customers 'dear', avoid..." />
      </UFormGroup>

      <div class="flex justify-end">
        <UButton type="submit" color="indigo" :loading="saving">Save profile</UButton>
      </div>
    </UForm>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const toast = useToast()
const { currentWorkspace, fetchWorkspaces } = useWorkspace()
const workspaceStore = useWorkspaceStore()

onMounted(() => { void fetchWorkspaces() })

const saving = ref(false)

const form = reactive<{
  businessName: string
  toneOfVoice: string
  brandRules: string
  languages: string[]
  openingHours: string
  targetCustomers: string
  doNotSayRules: string
}>({
  businessName: '',
  toneOfVoice: '',
  brandRules: '',
  languages: [],
  openingHours: '',
  targetCustomers: '',
  doNotSayRules: ''
})

watch(() => currentWorkspace.value, (ws) => {
  if (ws?.settings?.profile) {
    const p = ws.settings.profile as Record<string, any>
    Object.assign(form, {
      businessName: p.businessName || '',
      toneOfVoice: p.toneOfVoice || '',
      brandRules: p.brandRules || '',
      languages: Array.isArray(p.languages) ? p.languages : [],
      openingHours: p.openingHours || '',
      targetCustomers: p.targetCustomers || '',
      doNotSayRules: p.doNotSayRules || ''
    })
  }
}, { immediate: true })

const languageOptions = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Dutch',
  'Swedish',
  'Polish',
  'Romanian'
]

async function onSubmit () {
  if (!currentWorkspace.value) return
  saving.value = true
  try {
    await updateWorkspace(currentWorkspace.value.id, {
      settings: {
        ...(currentWorkspace.value.settings || {}),
        profile: { ...form }
      }
    })
    toast.add({ title: 'Profile saved', color: 'green' })
  } catch (err: any) {
    toast.add({ title: 'Failed to save', description: err?.data?.message || '', color: 'red' })
  } finally {
    saving.value = false
  }
}
</script>
