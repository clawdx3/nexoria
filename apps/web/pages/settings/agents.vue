<template>
  <div>
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-semibold">AI Agents</h1>
        <p class="text-slate-500 mt-1">Configure your AI assistants or create custom ones.</p>
      </div>
      <UButton color="primary" icon="i-heroicons-plus" @click="showCreateModal = true">
        Create Custom Agent
      </UButton>
    </div>

    <div class="space-y-6">
      <div v-for="agent in agents" :key="agent.id">
        <UCard>
          <div class="flex items-start justify-between">
            <div class="flex items-start gap-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <Bot class="h-6 w-6 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold">{{ agent.name }}</h3>
                  <UBadge v-if="agent.isBuiltIn" color="gray" size="xs">Built-in</UBadge>
                  <UBadge v-else color="indigo" size="xs">Custom</UBadge>
                </div>
                <p class="text-sm text-slate-500 mt-1">{{ agent.description }}</p>
                <div class="flex items-center gap-4 mt-3 text-xs text-slate-400">
                  <span class="flex items-center gap-1">
                    <Cpu class="h-3.5 w-3.5" /> {{ agent.modelProvider }} / {{ agent.modelName }}
                  </span>
                  <span class="flex items-center gap-1">
                    <Zap class="h-3.5 w-3.5" /> Level {{ agent.defaultAutonomyLevel }}
                  </span>
                  <span class="flex items-center gap-1">
                    <Wrench class="h-3.5 w-3.5" /> {{ agent.enabledTools.length }} tools
                  </span>
                </div>
              </div>
            </div>
            <UButton
              variant="ghost"
              color="gray"
              icon="i-heroicons-pencil-square"
              size="sm"
              @click="editAgent(agent)"
            />
          </div>
        </UCard>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <UModal v-model="showCreateModal">
      <UCard class="w-full max-w-2xl">
        <template #header>
          <h3 class="text-lg font-semibold">{{ editingId ? 'Edit Agent' : 'Create Custom Agent' }}</h3>
        </template>

        <form class="space-y-5" @submit.prevent="saveAgent">
          <UFormGroup label="Name">
            <UInput v-model="form.name" placeholder="e.g. Copywriter" required />
          </UFormGroup>

          <UFormGroup label="Description">
            <UInput v-model="form.description" placeholder="What does this agent do?" />
          </UFormGroup>

          <UFormGroup label="System Prompt">
            <UTextarea v-model="form.systemPrompt" :rows="6" placeholder="Define this agent's personality, role, and rules..." />
          </UFormGroup>

          <div class="grid grid-cols-2 gap-4">
            <UFormGroup label="Model Provider">
              <USelect v-model="form.modelProvider" :options="providers" />
            </UFormGroup>
            <UFormGroup label="Model Name">
              <UInput v-model="form.modelName" placeholder="gpt-4o-mini" />
            </UFormGroup>
          </div>

          <UFormGroup label="Autonomy Level">
            <div class="flex items-center gap-4">
              <USlider v-model="form.defaultAutonomyLevel" :min="0" :max="4" class="flex-1" />
              <span class="text-sm font-medium w-8">{{ form.defaultAutonomyLevel }}</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">{{ autonomyLabel }}</p>
          </UFormGroup>

          <UFormGroup label="Enabled Tools">
            <UCheckbox
              v-for="tool in availableTools"
              :key="tool"
              v-model="form.enabledTools"
              :value="tool"
              :label="tool"
              class="mb-2"
            />
          </UFormGroup>

          <div class="flex justify-end gap-3 pt-2">
            <UButton variant="ghost" @click="showCreateModal = false">Cancel</UButton>
            <UButton type="submit" color="primary">Save Agent</UButton>
          </div>
        </form>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { Bot, Cpu, Wrench, Zap } from 'lucide-vue-next'
import { computed, ref } from 'vue'

definePageMeta({ middleware: 'auth' })

const { agents, fetchAgents, createAgent, updateAgent } = useAgent()
const showCreateModal = ref(false)
const editingId = ref<string | null>(null)

const providers = ['openai', 'anthropic', 'openrouter', 'custom']
const availableTools = ['search_products', 'create_fb_draft', 'create_ig_draft', 'generate_image', 'draft_email_reply', 'create_internal_task']

const form = ref({
  name: '',
  description: '',
  systemPrompt: '',
  modelProvider: 'openai',
  modelName: 'gpt-4o-mini',
  defaultAutonomyLevel: 1,
  enabledTools: [] as string[],
  role: 'specialist' as string,
})

const autonomyLabels: Record<number, string> = {
  0: 'Manual assistant only',
  1: 'Proactive drafts',
  2: 'Actions after approval',
  3: 'Safe auto-actions',
  4: 'High-risk auto-actions',
}
const autonomyLabel = computed(() => autonomyLabels[form.value.defaultAutonomyLevel] || '')

onMounted(() => { void fetchAgents() })

function editAgent(agent: any) {
  editingId.value = agent.id
  form.value = {
    name: agent.name,
    description: agent.description,
    systemPrompt: agent.systemPrompt,
    modelProvider: agent.modelProvider,
    modelName: agent.modelName,
    defaultAutonomyLevel: agent.defaultAutonomyLevel,
    enabledTools: [...agent.enabledTools],
    role: agent.role,
  }
  showCreateModal.value = true
}

async function saveAgent() {
  if (editingId.value) {
    await updateAgent(editingId.value, form.value)
  } else {
    await createAgent(form.value)
  }
  showCreateModal.value = false
  editingId.value = null
  resetForm()
  await fetchAgents()
}

function resetForm() {
  form.value = {
    name: '',
    description: '',
    systemPrompt: '',
    modelProvider: 'openai',
    modelName: 'gpt-4o-mini',
    defaultAutonomyLevel: 1,
    enabledTools: [],
    role: 'specialist',
  }
}
</script>
