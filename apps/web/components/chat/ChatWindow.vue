<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
      <div class="flex items-center gap-3">
        <Bot class="h-6 w-6 text-indigo-500" />
        <div>
          <h1 class="text-lg font-semibold">{{ title }}</h1>
          <p class="text-sm text-slate-500">{{ subtitle }}</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 dark:border-slate-800">
          <ServerCog class="h-4 w-4 text-slate-500" />
          <span class="text-xs font-medium text-slate-600 dark:text-slate-300">OpenClaw</span>
          <UToggle v-model="useOpenClaw" size="sm" />
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div ref="scrollRef" class="flex-1 space-y-6 overflow-y-auto px-6 py-6">
      <div v-if="chatStore.messages.length === 0" class="flex h-full items-center justify-center">
        <div class="text-center text-slate-500">
          <Bot class="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <p class="text-sm">Start a conversation. The orchestrator will delegate to the right agent.</p>
        </div>
      </div>

      <ChatMessage
        v-for="msg in chatStore.messages"
        :key="msg.id"
        :role="msg.role"
        :content="msg.content"
        :agent-name="msg.agentName"
        :action-card="msg.actionCard"
      />

      <!-- Delegation status -->
      <div v-if="chatStore.isLoading" class="flex items-center gap-2 text-sm text-slate-500">
        <CommonLoadingSpinner size="sm" />
        <span v-if="delegatedAgent">{{ delegatedAgent }} is working on this...</span>
        <span v-else>{{ useOpenClaw ? 'OpenClaw is working on this...' : 'Thinking...' }}</span>
      </div>
    </div>

    <!-- Input -->
    <ChatInput :disabled="chatStore.isLoading" @send="onSend" />
  </div>
</template>

<script setup lang="ts">
import { Bot, ServerCog } from 'lucide-vue-next'

const props = defineProps<{
  agentRole?: string
  agentProfileId?: string
}>()

const chatStore = useChatStore()
const { agents, fetchAgents } = useAgent()
const scrollRef = ref<HTMLDivElement | null>(null)

const useOpenClaw = ref(false)

onMounted(() => {
  void fetchAgents()
})

const title = computed(() => {
  if (props.agentProfileId) {
    const a = agents.value.find(x => x.id === props.agentProfileId)
    return a?.name || 'Agent'
  }
  return 'Team Lead'
})

const subtitle = computed(() => {
  if (props.agentProfileId) {
    const a = agents.value.find(x => x.id === props.agentProfileId)
    return a?.description || ''
  }
  return 'Ask anything. The orchestrator will delegate to the right agent.'
})

const delegatedAgent = computed(() => {
  // In a real app you'd parse delegation from streaming metadata.
  return ''
})

function onSend (content: string) {
  void chatStore.sendMessage(content, props.agentProfileId || 'orchestrator', useOpenClaw.value ? 'openclaw' : 'nexoria')
}

watch(() => chatStore.messages.length, async () => {
  await nextTick()
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  }
})
</script>
