<template>
  <div class="border-t border-slate-200 p-4 dark:border-slate-800">
    <div
      class="relative flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <input ref="fileInput" type="file" multiple class="hidden" @change="onFileChange">
      <UButton
        color="gray"
        variant="ghost"
        size="sm"
        :disabled="disabled"
        class="shrink-0"
        @click="fileInput?.click()"
      >
        <Paperclip class="h-4 w-4" />
      </UButton>
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
        :disabled="disabled || (!text.trim() && selectedFiles.length === 0)"
        class="shrink-0"
        @click="submit"
      >
        <Send class="h-4 w-4" />
      </UButton>
    </div>
    <div v-if="selectedFiles.length" class="mt-2 flex flex-wrap gap-2">
      <span
        v-for="file in selectedFiles"
        :key="file.name + file.size"
        class="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
      >
        {{ file.name }}
        <button type="button" class="text-slate-400 hover:text-red-500" @click="removeFile(file)">x</button>
      </span>
    </div>
    <div class="mt-1 text-right text-xs text-slate-500">
      Ctrl + Enter to send
    </div>
  </div>
</template>

<script setup lang="ts">
import { Paperclip, Send } from 'lucide-vue-next'

const text = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const selectedFiles = ref<File[]>([])

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'send', content: string, files: File[]): void
}>()

function submit () {
  const trimmed = text.value.trim()
  if ((!trimmed && selectedFiles.value.length === 0) || props.disabled) return
  emit('send', trimmed, selectedFiles.value)
  text.value = ''
  selectedFiles.value = []
  if (fileInput.value) fileInput.value.value = ''
}

function onFileChange (event: Event) {
  const input = event.target as HTMLInputElement
  selectedFiles.value = [...selectedFiles.value, ...Array.from(input.files || [])]
}

function onDrop (event: DragEvent) {
  selectedFiles.value = [...selectedFiles.value, ...Array.from(event.dataTransfer?.files || [])]
}

function removeFile (file: File) {
  selectedFiles.value = selectedFiles.value.filter(item => item !== file)
}

function onKeydown (event: KeyboardEvent) {
  if (event.ctrlKey && event.key === 'Enter') {
    event.preventDefault()
    submit()
  }
}
</script>
