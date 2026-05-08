<template>
  <div class="nx-page-wide">
    <div style="margin-bottom:24px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <div class="text-tiny" style="margin-bottom:6px;">Operations</div>
        <div class="nx-h-display">Schedules</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px;">Recurring jobs your agents run on autopilot. Pause anything that gets noisy.</div>
      </div>
      <button class="nx-btn nx-btn-accent" @click="showCreate = true">
        <Plus :size="13" /> New schedule
      </button>
    </div>

    <div v-if="schedules.length === 0" style="padding:64px;text-align:center;">
      <div style="width:44px;height:44px;border-radius:12px;background:var(--bg-sunk);display:inline-flex;align-items:center;justify-content:center;color:var(--muted);margin-bottom:12px;">
        <Clock :size="20" />
      </div>
      <div class="nx-h-heading" style="margin-bottom:4px;">No schedules yet</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:16px;">Set up recurring agent runs — morning digests, weekly sweeps, monthly reports.</div>
      <button class="nx-btn nx-btn-accent" @click="showCreate = true"><Plus :size="13" /> Create first schedule</button>
    </div>

    <div v-else class="nx-surface" style="overflow:hidden;">
      <div
        v-for="(s, i) in schedules"
        :key="s.id"
        style="display:grid;grid-template-columns:auto 1fr auto auto auto;gap:14px;align-items:center;padding:16px 18px;"
        :style="{ borderBottom: i < schedules.length - 1 ? '1px solid var(--line)' : 'none' }"
      >
        <NxAvatar :name="s.agentName || 'Agent'" :color="agentColorPalette[i % 4]" size="lg" />
        <div>
          <div style="font-size:13px;font-weight:600;">{{ s.name || s.title }}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">{{ s.cadence || s.cron || 'Custom schedule' }}</div>
        </div>
        <span style="font-size:11px;color:var(--muted);display:inline-flex;align-items:center;gap:4px;">
          <Clock :size="11" /> Next: {{ s.nextRun || 'TBD' }}
        </span>
        <button class="nx-icon-btn bordered" :title="s.enabled ? 'Pause' : 'Resume'">
          <Pause v-if="s.enabled" :size="14" />
          <Play v-else :size="14" />
        </button>
        <button class="nx-icon-btn"><MoreHorizontal :size="14" /></button>
      </div>
    </div>

    <!-- Create modal -->
    <template v-if="showCreate">
      <div class="nx-scrim" @click="showCreate = false" />
      <div class="nx-modal" style="padding:0;">
        <div style="padding:16px 22px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;">
          <div class="nx-h-title">New schedule</div>
          <button class="nx-icon-btn" @click="showCreate = false"><X :size="16" /></button>
        </div>
        <div style="padding:22px;display:flex;flex-direction:column;gap:16px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">Title</label>
            <input v-model="createForm.title" class="nx-input" placeholder="e.g. Daily Instagram check-in" />
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">Cadence</label>
            <div class="nx-seg" style="display:flex;flex-wrap:wrap;">
              <button v-for="c in cadences" :key="c.id" :class="{ on: createForm.cadence === c.id }" @click="createForm.cadence = c.id">{{ c.label }}</button>
            </div>
          </div>
        </div>
        <div style="padding:16px 22px;border-top:1px solid var(--line);display:flex;justify-content:flex-end;gap:8px;">
          <button class="nx-btn nx-btn-ghost" @click="showCreate = false">Cancel</button>
          <button class="nx-btn nx-btn-accent" :disabled="!createForm.title">Create schedule</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Plus, Clock, Pause, Play, MoreHorizontal, X } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const agentColorPalette = ['#C25B3F', '#7C5CC2', '#3F8FC2', '#5C9C6E']
const showCreate = ref(false)
const createForm = reactive({ title: '', cadence: 'daily' })

const cadences = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'custom', label: 'Custom' },
]

const schedules = ref<any[]>([])
</script>
