<template>
  <div style="display:grid;grid-template-columns:260px 1fr 300px;height:calc(100vh - 56px);overflow:hidden;">

    <!-- Agent list -->
    <div style="border-right:1px solid var(--line);background:var(--bg-elev);display:flex;flex-direction:column;">
      <div style="padding:16px 14px 10px;">
        <div class="text-tiny">Talk to</div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:0 8px 12px;">
        <NuxtLink
          v-for="a in allAgents"
          :key="a.id"
          :to="`/chat/${a.id}`"
          style="display:flex;align-items:center;gap:10px;width:100%;padding:10px;border-radius:10px;margin-bottom:2px;text-align:left;text-decoration:none;transition:background .12s;"
          :style="{
            background: a.id === currentAgentId ? 'var(--bg-sunk)' : 'transparent',
            opacity: a.isEnabled !== false ? 1 : 0.55,
          }"
        >
          <NxAvatar :name="a.name" :color="agentColor(a)" />
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;" :style="{ fontWeight: a.id === currentAgentId ? 600 : 500 }">{{ a.name }}</div>
            <div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ a.role || 'Agent' }}</div>
          </div>
        </NuxtLink>
      </div>
      <div style="padding:12px;border-top:1px solid var(--line);">
        <button class="nx-btn nx-btn-ghost nx-btn-sm" style="width:100%;" @click="navigateTo('/settings/agents')">
          <Plus :size="13" /> New custom agent
        </button>
      </div>
    </div>

    <!-- Chat area -->
    <div style="display:flex;flex-direction:column;min-width:0;">
      <!-- Chat header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 22px;border-bottom:1px solid var(--line);">
        <div style="display:flex;align-items:center;gap:12px;">
          <NxAvatar :name="currentAgent?.name || 'Agent'" :color="agentColor(currentAgent)" size="lg" />
          <div>
            <div class="nx-h-heading" style="margin-bottom:2px;">{{ currentAgent?.name || 'Team Lead' }}</div>
            <div style="font-size:12px;color:var(--muted);">{{ currentAgent?.description || 'Routes work to specialist agents' }}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;padding:4px 10px 4px 8px;border:1px solid var(--line);border-radius:9px;background:var(--bg-sunk);">
            <Server :size="13" />
            <span style="font-size:12px;">OpenClaw</span>
            <button class="nx-switch on"><span class="nx-switch-thumb" /></button>
          </div>
          <button class="nx-icon-btn bordered"><MoreHorizontal :size="15" /></button>
        </div>
      </div>

      <!-- Messages -->
      <div ref="scrollRef" style="flex:1;overflow-y:auto;padding:24px 22px;">
        <div style="max-width:720px;margin:0 auto;display:flex;flex-direction:column;gap:22px;">
          <div v-if="chatStore.messages.length === 0" style="text-align:center;padding:48px 0;">
            <div style="font-size:14px;color:var(--muted);margin-bottom:16px;">
              What would you like {{ currentAgent?.name || 'Team Lead' }} to do?
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
              <button
                v-for="p in starterPrompts"
                :key="p"
                class="nx-btn nx-btn-soft nx-btn-sm"
                @click="sendPrompt(p)"
              >{{ p }}</button>
            </div>
          </div>

          <template v-for="msg in chatStore.messages" :key="msg.id">
            <!-- User message -->
            <div v-if="msg.role === 'user'" style="display:flex;justify-content:flex-end;">
              <div style="max-width:78%;padding:10px 14px;border-radius:14px 14px 4px 14px;background:var(--ink);color:var(--bg-elev);font-size:14px;">{{ msg.content }}</div>
            </div>
            <!-- Assistant message -->
            <div v-else style="display:flex;gap:12px;align-items:flex-start;">
              <NxAvatar :name="msg.agentName || currentAgent?.name || 'Agent'" :color="agentColor(currentAgent)" />
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;">
                  <span style="font-size:13px;font-weight:600;">{{ msg.agentName || currentAgent?.name || 'Agent' }}</span>
                  <span style="font-size:11px;color:var(--muted);">just now</span>
                </div>
                <div style="font-size:14px;line-height:1.55;white-space:pre-wrap;">{{ msg.content }}</div>
                <div v-if="msg.actionCard" style="margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--bg-sunk);display:flex;align-items:center;gap:12px;">
                  <span style="width:28px;height:28px;border-radius:8px;background:var(--accent-soft);color:var(--accent-soft-ink);display:inline-flex;align-items:center;justify-content:center;"><ArrowRight :size="14" /></span>
                  <div style="flex:1;">
                    <div style="font-size:11px;color:var(--muted);">Delegated to</div>
                    <div style="font-size:13px;font-weight:600;">{{ msg.actionCard.agentName }}</div>
                    <div style="font-size:11px;color:var(--muted);margin-top:2px;">"{{ msg.actionCard.task }}"</div>
                  </div>
                  <span class="nx-tag info dot">running</span>
                </div>
              </div>
            </div>
          </template>

          <div v-if="chatStore.isLoading" style="display:flex;gap:12px;align-items:flex-start;">
            <NxAvatar :name="currentAgent?.name || 'Agent'" :color="agentColor(currentAgent)" />
            <div style="padding-top:8px;">
              <span style="font-size:13px;color:var(--muted);display:inline-flex;align-items:center;gap:6px;">
                <span class="nx-live-dot" /> Working
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div style="padding:14px 22px 22px;border-top:1px solid var(--line);">
        <div style="max-width:720px;margin:0 auto;">
          <div style="border:1px solid var(--line);border-radius:14px;background:var(--bg-elev);padding:12px;box-shadow:var(--shadow-1);">
            <textarea
              v-model="message"
              :placeholder="`Message ${currentAgent?.name || 'Team Lead'}…`"
              style="width:100%;border:none;outline:none;background:transparent;resize:none;font-size:14px;color:var(--ink);min-height:48px;font-family:var(--font-sans);"
              rows="2"
              @keydown="onKeydown"
            />
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;">
              <div style="display:flex;gap:4px;">
                <button class="nx-icon-btn" title="Attach"><Paperclip :size="14" /></button>
                <button class="nx-icon-btn" title="Voice"><Mic :size="14" /></button>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:11px;color:var(--muted);">⌘ + Return to send</span>
                <button class="nx-btn nx-btn-accent nx-btn-sm" :disabled="!message.trim() || chatStore.isLoading" @click="sendMessage">
                  <Send :size="13" /> Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Context rail -->
    <div style="border-left:1px solid var(--line);background:var(--bg-elev);overflow-y:auto;">
      <div style="padding:16px;">
        <div class="text-tiny" style="margin-bottom:10px;">Context</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;justify-content:space-between;font-size:12.5px;">
            <span style="color:var(--muted);">Model</span>
            <span style="font-weight:500;font-family:var(--font-mono);">{{ (currentAgent?.model || 'claude-sonnet-4').replace('claude-', '') }}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12.5px;">
            <span style="color:var(--muted);">Autonomy</span>
            <span style="font-weight:500;">Level {{ currentAgent?.autonomyLevel ?? 1 }}</span>
          </div>
        </div>

        <div class="text-tiny" style="margin:20px 0 10px;">Recent files</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div v-for="f in recentFiles" :key="f.name" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;background:var(--bg-sunk);">
            <FileIcon :size="13" />
            <span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ f.name }}</span>
            <span style="font-size:11px;color:var(--muted);font-family:var(--font-mono);">{{ f.size }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus, Server, MoreHorizontal, Paperclip, Mic, Send, ArrowRight } from 'lucide-vue-next'
import { File as FileIcon } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const { agents: rawAgents, fetchAgents } = useAgent()
const chatStore = useChatStore()

onMounted(() => { void fetchAgents() })

const currentAgentId = computed(() => route.params.profile as string || 'orchestrator')
const allAgents = computed(() => rawAgents.value)
const currentAgent = computed(() => rawAgents.value.find((a: any) => a.id === currentAgentId.value) || rawAgents.value[0])

const agentColorPalette = ['#C25B3F', '#7C5CC2', '#3F8FC2', '#5C9C6E', '#C29A3F']
function agentColor (a: any): string {
  if (!a) return agentColorPalette[0]
  if (a.metadata?.color) return a.metadata.color
  return agentColorPalette[(a.name || '').charCodeAt(0) % agentColorPalette.length]
}

const message = ref('')
const scrollRef = ref<HTMLDivElement>()

const starterPrompts = [
  'What needs my attention today?',
  'Plan a 7-day Instagram campaign',
  'Find 3 micro-influencers',
  'Draft a reply to last week\'s reviews',
]

const recentFiles = [
  { name: 'competitor-sweep.md', size: '12 KB' },
  { name: 'spring-carousel-1.png', size: '1.4 MB' },
  { name: 'april-newsletter.txt', size: '8 KB' },
]

function sendPrompt (p: string) {
  message.value = p
  sendMessage()
}

function sendMessage () {
  const content = message.value.trim()
  if (!content || chatStore.isLoading) return
  void chatStore.sendMessage(content, currentAgentId.value, 'openclaw')
  message.value = ''
}

function onKeydown (e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    sendMessage()
  }
}

watch(() => chatStore.messages.length, async () => {
  await nextTick()
  if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight
})
</script>
