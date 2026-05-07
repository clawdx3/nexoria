<template>
  <div class="flex items-center gap-2">
    <USelectMenu
      v-model="selected"
      :options="options"
      option-attribute="name"
      value-attribute="id"
      class="w-48"
      size="xs"
      placeholder="Select agent"
      @change="onChange"
    >
      <template #leading>
        <Bot class="h-4 w-4 text-slate-500" />
      </template>
    </USelectMenu>
  </div>
</template>

<script setup lang="ts">
import { Bot } from 'lucide-vue-next'
import type { AgentProfile } from '~/types'

const props = defineProps<{
  agents: AgentProfile[]
  modelValue?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', id: string | null): void
}>()

const options = computed(() => [
  { id: null, name: 'Orchestrator (Team Lead)' },
  ...props.agents
])

const selected = computed({
  get: () => props.modelValue,
  set: (val: string | null) => emit('update:modelValue', val)
})

function onChange (val: string | null) {
  emit('update:modelValue', val)
}
</script>
