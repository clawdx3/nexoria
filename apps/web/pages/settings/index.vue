<template>
  <div class="nx-page-wide" style="max-width:980px;">
    <div style="margin-bottom:24px;">
      <div class="text-tiny" style="margin-bottom:6px;">Account</div>
      <div class="nx-h-display">Settings</div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-bottom:28px;">
      <NuxtLink
        v-for="s in sections"
        :key="s.to"
        :to="s.to"
        class="nx-surface"
        style="padding:16px;cursor:pointer;display:block;text-decoration:none;transition:border-color .12s;"
        @mouseenter="(e) => (e.currentTarget as HTMLElement).style.borderColor = 'var(--line-strong)'"
        @mouseleave="(e) => (e.currentTarget as HTMLElement).style.borderColor = ''"
      >
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          <span style="width:36px;height:36px;border-radius:9px;background:var(--bg-sunk);color:var(--ink-2);display:inline-flex;align-items:center;justify-content:center;">
            <component :is="s.icon" :size="16" />
          </span>
          <div class="nx-h-heading">{{ s.title }}</div>
        </div>
        <div style="font-size:13px;color:var(--muted);">{{ s.desc }}</div>
      </NuxtLink>
    </div>

    <!-- Business profile inline -->
    <div class="nx-surface" style="overflow:hidden;">
      <div style="padding:14px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div class="nx-h-heading">Business profile</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px;">What every agent knows about you</div>
        </div>
      </div>
      <div style="padding:16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">Business name</label>
            <input v-model="form.name" class="nx-input" placeholder="e.g. Studio Vukov" />
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">Languages</label>
            <input v-model="form.languages" class="nx-input" placeholder="e.g. English, German" />
          </div>
          <div style="grid-column:1/-1;">
            <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">Brand voice (1–2 sentences)</label>
            <textarea v-model="form.brandVoice" class="nx-input" rows="2" placeholder="Warm, casual, never salesy. Light emoji on Instagram only." />
          </div>
          <div style="grid-column:1/-1;">
            <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">Don't say…</label>
            <textarea v-model="form.doNotSay" class="nx-input" rows="2" placeholder="'Guys' (use 'friends'). 'Cheap'. Anything implying scarcity we can't back up." />
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:12px;">
          <button class="nx-btn nx-btn-accent">Save changes</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Users, BarChart2, Server, Bell, Lock } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const sections = [
  { to: '/settings/profile', icon: Users, title: 'Business profile', desc: 'Brand voice, languages, do-not-say rules' },
  { to: '/settings/team', icon: Users, title: 'Team', desc: 'Members · invite people' },
  { to: '/settings/runtime', icon: Server, title: 'VPS', desc: 'Frankfurt · 4 vCPU · 8 GB · 80 GB SSD' },
  { to: '/settings', icon: Bell, title: 'Notifications', desc: 'Approval pings, daily digest' },
  { to: '/settings', icon: Lock, title: 'Security & access', desc: '2FA, session log, API keys' },
  { to: '/settings', icon: BarChart2, title: 'Billing & usage', desc: 'Growth · tokens used' },
]

const form = reactive({ name: '', languages: 'English', brandVoice: '', doNotSay: '' })
</script>
