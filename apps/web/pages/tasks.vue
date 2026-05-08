<template>
  <div class="nx-page-wide">

    <!-- Page header -->
    <div style="margin-bottom:24px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <div class="text-tiny" style="margin-bottom:6px;">Work</div>
        <div class="nx-h-display">Tasks</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px;max-width:580px;">Everything your agents are doing. Click any card to continue in chat.</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <div class="nx-seg">
          <button :class="{ on: view === 'board' }" @click="view = 'board'">Board</button>
          <button :class="{ on: view === 'list' }" @click="view = 'list'">List</button>
        </div>
        <button class="nx-btn nx-btn-accent" @click="showCreate = true">
          <Plus :size="13" /> New task
        </button>
      </div>
    </div>

    <!-- Filter bar -->
    <div style="display:flex;gap:8px;margin-bottom:20px;align-items:center;">
      <div class="nx-seg">
        <button :class="{ on: filter === 'all' }" @click="filter = 'all'">All · {{ tasks.length }}</button>
        <button :class="{ on: filter === 'pending' }" @click="filter = 'pending'">Pending</button>
        <button :class="{ on: filter === 'in_progress' }" @click="filter = 'in_progress'">In Progress</button>
        <button :class="{ on: filter === 'review' }" @click="filter = 'review'">Review</button>
        <button :class="{ on: filter === 'done' }" @click="filter = 'done'">Done</button>
      </div>
      <div style="flex:1;" />
      <button class="nx-btn nx-btn-ghost nx-btn-sm"><Filter :size="13" /> Filter</button>
    </div>

    <!-- Board view -->
    <div v-if="view === 'board'" style="display:grid;grid-template-columns:repeat(4,minmax(260px,1fr));gap:14px;align-items:start;overflow-x:auto;">
      <div v-for="col in cols" :key="col.id">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0 4px 10px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="nx-tag dot" :class="col.tone">{{ col.label }}</span>
            <span style="font-size:11px;color:var(--muted);font-family:var(--font-mono);">{{ colTasks(col.id).length }}</span>
          </div>
          <button class="nx-icon-btn"><Plus :size="14" /></button>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button
            v-for="t in colTasks(col.id)"
            :key="t.id"
            class="nx-surface"
            style="padding:12px;text-align:left;display:block;cursor:pointer;transition:border-color .12s,transform .08s;width:100%;"
            @mouseenter="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--line-strong)'"
            @mouseleave="(e: MouseEvent) => (e.currentTarget as HTMLElement).style.borderColor = ''"
            @click="navigateTo('/chat')"
          >
            <div v-if="t.metadata?.missionName" style="font-size:11px;color:var(--muted);margin-bottom:6px;display:flex;align-items:center;gap:4px;">
              <Hash :size="11" /> {{ t.metadata.missionName }}
            </div>
            <div style="font-size:13.5px;font-weight:500;line-height:1.4;margin-bottom:10px;">{{ t.title }}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
              <NxAvatar :name="t.metadata?.agentName || 'Agent'" :color="agentColor(t)" />
              <span v-if="t.dueDate" style="font-size:11px;color:var(--muted);display:inline-flex;align-items:center;gap:4px;">
                <CalendarIcon :size="11" />{{ formatDate(t.dueDate) }}
              </span>
            </div>
          </button>
          <div v-if="colTasks(col.id).length === 0" style="padding:18px;text-align:center;border:1px dashed var(--line);border-radius:12px;color:var(--muted);font-size:12px;">
            No tasks here
          </div>
        </div>
      </div>
    </div>

    <!-- List view -->
    <div v-else class="nx-surface" style="overflow:hidden;">
      <div v-if="isLoading" style="padding:40px;text-align:center;color:var(--muted);font-size:13px;">Loading…</div>
      <div v-else-if="filteredTasks.length === 0" style="padding:40px;text-align:center;color:var(--muted);font-size:13px;">No tasks yet.</div>
      <div
        v-for="(t, i) in filteredTasks"
        :key="t.id"
        style="display:grid;grid-template-columns:auto 1fr auto auto auto;gap:14px;align-items:center;padding:14px 16px;"
        :style="{ borderBottom: i < filteredTasks.length - 1 ? '1px solid var(--line)' : 'none' }"
      >
        <span
          style="width:18px;height:18px;border-radius:5px;border:1.5px solid var(--line-strong);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;"
          :style="t.status === 'done' ? { background: 'var(--ok)', borderColor: 'var(--ok)' } : {}"
          @click="toggleDone(t)"
        >
          <Check v-if="t.status === 'done'" :size="11" style="color:white;" />
        </span>
        <div>
          <div style="font-size:14px;font-weight:500;" :style="t.status === 'done' ? { textDecoration: 'line-through', opacity: 0.6 } : {}">{{ t.title }}</div>
          <div v-if="t.metadata?.missionName" style="font-size:12px;color:var(--muted);margin-top:2px;">{{ t.metadata.missionName }}</div>
        </div>
        <NxAvatar :name="t.metadata?.agentName || 'Agent'" :color="agentColor(t)" />
        <span v-if="t.dueDate" style="font-size:11px;color:var(--muted);">{{ formatDate(t.dueDate) }}</span>
        <span class="nx-tag dot" :class="statusTone(t.status)">{{ t.status.replace('_', ' ') }}</span>
      </div>
    </div>

    <!-- Create modal -->
    <template v-if="showCreate">
      <div class="nx-scrim" @click="showCreate = false" />
      <div class="nx-modal" style="padding:0;">
        <div style="padding:16px 22px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;">
          <div class="nx-h-title">New task</div>
          <button class="nx-icon-btn" @click="showCreate = false"><X :size="16" /></button>
        </div>
        <div style="padding:22px;display:flex;flex-direction:column;gap:16px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">Title</label>
            <input v-model="createForm.title" class="nx-input" placeholder="Task title" />
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">Description</label>
            <textarea v-model="createForm.description" class="nx-input" rows="3" placeholder="Describe what needs to be done…" />
          </div>
        </div>
        <div style="padding:16px 22px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:8px;">
          <button class="nx-btn nx-btn-ghost" @click="showCreate = false">Cancel</button>
          <button class="nx-btn nx-btn-accent" :disabled="!createForm.title || creating" @click="submitCreate">
            {{ creating ? 'Creating…' : 'Create task' }}
          </button>
        </div>
      </div>
    </template>

  </div>
</template>

<script setup lang="ts">
import { Plus, Filter, Hash, Check, X } from 'lucide-vue-next'
import { Calendar as CalendarIcon } from 'lucide-vue-next'
import type { Task } from '~/types'

definePageMeta({ middleware: 'auth' })

const { tasks, isLoading, fetchTasks, createTask, updateTask } = useTasks()

onMounted(() => { void fetchTasks() })

const view = ref<'board' | 'list'>('board')
const filter = ref('all')
const showCreate = ref(false)
const creating = ref(false)
const createForm = reactive({ title: '', description: '' })

const cols = [
  { id: 'pending', label: 'Pending', tone: 'warn' },
  { id: 'in_progress', label: 'In Progress', tone: 'info' },
  { id: 'review', label: 'Review', tone: 'accent' },
  { id: 'done', label: 'Done', tone: 'ok' },
]

const filteredTasks = computed(() => {
  if (filter.value === 'all') return tasks.value
  return tasks.value.filter((t: Task) => t.status === filter.value)
})

function colTasks (status: string) {
  return tasks.value.filter((t: Task) => t.status === status)
}

const agentColorPalette = ['#C25B3F', '#7C5CC2', '#3F8FC2', '#5C9C6E', '#C29A3F']
function agentColor (t: Task): string {
  if (t.metadata?.agentColor) return t.metadata.agentColor as string
  const idx = ((t.metadata?.agentName as string) || 'A').charCodeAt(0) % agentColorPalette.length
  return agentColorPalette[idx]
}

function statusTone (status: string) {
  if (status === 'done') return 'ok'
  if (status === 'in_progress') return 'info'
  if (status === 'review') return 'accent'
  return 'warn'
}

function formatDate (d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

async function toggleDone (t: Task) {
  await updateTask(t.id, { status: t.status === 'done' ? 'pending' : 'done' })
}

async function submitCreate () {
  if (!createForm.title) return
  creating.value = true
  try {
    await createTask({ title: createForm.title, description: createForm.description })
    showCreate.value = false
    Object.assign(createForm, { title: '', description: '' })
  } finally {
    creating.value = false
  }
}
</script>
