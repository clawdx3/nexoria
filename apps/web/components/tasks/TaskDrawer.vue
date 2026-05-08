<template>
  <template v-if="open">
    <div class="nx-scrim" @click="emit('close')" />
    <div class="nx-drawer" style="display:flex;flex-direction:column;">

      <!-- Header -->
      <div style="padding:16px 22px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;gap:12px;">
        <div style="flex:1;min-width:0;">
          <div class="text-tiny" style="margin-bottom:4px;">Task</div>
          <div class="nx-h-title" style="word-break:break-word;">{{ task?.title || 'Loading…' }}</div>
          <div v-if="task" style="display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap;">
            <span class="nx-tag dot" :class="statusTone(task.status)">{{ task.status.replace('_', ' ') }}</span>
            <span v-if="task.priority" class="nx-tag">{{ task.priority }}</span>
            <span v-for="tag in (task.tags || [])" :key="tag" class="nx-tag">{{ tag }}</span>
          </div>
        </div>
        <button class="nx-icon-btn" @click="emit('close')"><X :size="16" /></button>
      </div>

      <!-- Body -->
      <div style="flex:1;overflow-y:auto;padding:20px 22px;">

        <!-- Description -->
        <section v-if="task?.description" style="margin-bottom:24px;">
          <div class="text-tiny" style="margin-bottom:8px;">Description</div>
          <div style="font-size:13px;line-height:1.55;color:var(--ink-2);white-space:pre-wrap;">{{ task.description }}</div>
        </section>

        <!-- Status changer -->
        <section v-if="task" style="margin-bottom:24px;">
          <div class="text-tiny" style="margin-bottom:8px;">Status</div>
          <div class="nx-seg" style="display:flex;flex-wrap:wrap;">
            <button
              v-for="s in statuses"
              :key="s"
              :class="{ on: task.status === s }"
              :disabled="updating"
              @click="changeStatus(s)"
            >{{ s.replace('_', ' ') }}</button>
          </div>
        </section>

        <!-- Attachments -->
        <section style="margin-bottom:24px;">
          <div class="text-tiny" style="margin-bottom:8px;">Attachments · {{ attachments.length }}</div>
          <div v-if="attachmentsLoading" style="font-size:12px;color:var(--muted);padding:8px 0;">Loading…</div>
          <div v-else-if="attachments.length === 0" style="font-size:12px;color:var(--muted);padding:8px 0;">No files attached.</div>
          <div v-else style="display:flex;flex-direction:column;gap:6px;">
            <button
              v-for="a in attachments"
              :key="a.id"
              style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:var(--bg-elev);text-align:left;cursor:pointer;width:100%;"
              @click="openAttachment(a)"
            >
              <span style="width:30px;height:30px;border-radius:7px;background:var(--bg-sunk);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
                <FileIcon :size="14" />
              </span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ a.filename }}</div>
                <div style="font-size:11px;color:var(--muted);font-family:var(--font-mono);">{{ formatSize(a.sizeBytes) }} · {{ a.mimeType }}</div>
              </div>
              <Download :size="14" style="color:var(--muted);" />
            </button>
          </div>
        </section>

        <!-- Comments -->
        <section v-if="comments.length > 0">
          <div class="text-tiny" style="margin-bottom:8px;">Comments · {{ comments.length }}</div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div v-for="c in comments" :key="c.id" style="padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:var(--bg-elev);">
              <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">{{ c.authorName || c.authorAgentProfileId || 'System' }} · {{ formatRelative(c.createdAt) }}</div>
              <div style="font-size:13px;line-height:1.5;white-space:pre-wrap;">{{ c.content }}</div>
            </div>
          </div>
        </section>

      </div>

      <!-- Footer -->
      <div v-if="task" style="padding:14px 22px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:8px;">
        <button class="nx-btn nx-btn-ghost" @click="openInChat">
          <MessageSquare :size="13" /> Open in chat
        </button>
        <span style="font-size:11px;color:var(--muted);align-self:center;font-family:var(--font-mono);">{{ task.id.slice(0, 8) }}</span>
      </div>

    </div>
  </template>
</template>

<script setup lang="ts">
import { File as FileIcon, X, Download, MessageSquare } from 'lucide-vue-next'

const props = defineProps<{ open: boolean; taskId: string | null }>()
const emit = defineEmits<{ close: []; updated: [] }>()

const task = ref<any>(null)
const attachments = ref<any[]>([])
const comments = ref<any[]>([])
const attachmentsLoading = ref(false)
const updating = ref(false)

const statuses = ['pending', 'in_progress', 'review', 'done', 'cancelled']

const { listByTask, downloadUrl } = useAttachments()
const { updateTask } = useTasks()
const workspaceStore = useWorkspaceStore()

async function loadTask () {
  if (!props.taskId) return
  task.value = null
  attachments.value = []
  comments.value = []
  const ws = await workspaceStore.ensureWorkspace()
  if (!ws) return
  attachmentsLoading.value = true
  try {
    const [taskRes, commentsRes, atts] = await Promise.all([
      useApi<any>(`/workspaces/${ws}/tasks/${props.taskId}`),
      useApi<any[]>(`/workspaces/${ws}/tasks/${props.taskId}/comments`).catch(() => []),
      listByTask(props.taskId),
    ])
    task.value = taskRes
    comments.value = commentsRes || []
    attachments.value = atts || []
  } finally {
    attachmentsLoading.value = false
  }
}

watch(() => [props.open, props.taskId], async ([o, id]) => {
  if (o && id) await loadTask()
})

async function changeStatus (status: string) {
  if (!task.value || updating.value) return
  updating.value = true
  try {
    await updateTask(task.value.id, { status })
    task.value.status = status
    emit('updated')
  } finally {
    updating.value = false
  }
}

async function openAttachment (a: any) {
  try {
    const url = await downloadUrl(a.id)
    window.open(url, '_blank', 'noopener')
  } catch (err) {
    console.error('Failed to open attachment', err)
  }
}

function openInChat () {
  if (!task.value) return
  navigateTo(`/chat/${task.value.metadata?.agentProfileId || 'orchestrator'}`)
}

function statusTone (status: string) {
  if (status === 'done') return 'ok'
  if (status === 'in_progress') return 'info'
  if (status === 'review') return 'accent'
  if (status === 'cancelled') return 'danger'
  return 'warn'
}

function formatSize (bytes?: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelative (iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}
</script>
