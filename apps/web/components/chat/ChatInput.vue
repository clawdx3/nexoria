<template>
  <div class="border-t border-slate-200 p-4 dark:border-slate-800">
    <div class="relative flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <UTextarea
        ref="inputRef"
        v-model="text"
        placeholder="Type a message..."
        :rows="1"
        :maxrows="6"
        autoresize
        class="w-full border-0 bg-transparent px-2 py-1 text-sm focus:ring-0 dark:text-slate-100"
        :disabled="disabled"
        @keydown="onKeydown"
      />
      <UButton
        color="indigo"
        variant="solid"
        size="sm"
        :disabled="disabled || !text.trim()"
        class="shrink-0"
        @click="submit"
      >
        <Send class="h-4 w-4" />
      </UButton>
    </div>
    <div class="mt-1 text-right text-xs text-slate-500">
      Ctrl + Enter to send
    </div>
  </div>
</template>

<script setup lang="ts">
import { Send } from 'lucide-vue-next'

const text = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'send', content: string): void
}>()

function submit () {
  const trimmed = text.value.trim()
  if (!trimmed || props.disabled) return
  emit('send', trimmed)
  text.value = ''
}

function onKeydown (event: KeyboardEvent) {
  if (event.ctrlKey && event.key === 'Enter') {
    event.preventDefault()
    submit()
  }
}
</script>
