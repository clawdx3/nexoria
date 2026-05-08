<template>
  <div class="nx-page-wide">
    <div style="margin-bottom:24px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <div class="text-tiny" style="margin-bottom:6px;">Build</div>
        <div class="nx-h-display">Playbooks</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px;">Multi-step workflows your team runs over and over. Made of triggers, agents and approvals.</div>
      </div>
      <button class="nx-btn nx-btn-accent"><Plus :size="13" /> New playbook</button>
    </div>

    <div class="text-tiny" style="margin-bottom:12px;">Templates · start from one</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
      <div v-for="s in samples" :key="s.title" class="nx-surface" style="padding:16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <span style="width:32px;height:32px;border-radius:9px;background:var(--accent-soft);color:var(--accent-soft-ink);display:inline-flex;align-items:center;justify-content:center;">
            <Workflow :size="15" />
          </span>
          <div class="nx-h-heading">{{ s.title }}</div>
        </div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:12px;">{{ s.desc }}</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
          <div
            v-for="(step, i) in s.steps"
            :key="i"
            style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-sunk);border-radius:7px;"
          >
            <span style="font-family:var(--font-mono);font-size:11px;color:var(--muted);width:14px;">{{ i + 1 }}</span>
            <span style="font-size:12px;">{{ step }}</span>
          </div>
        </div>
        <button class="nx-btn nx-btn-soft nx-btn-sm" style="width:100%;">Use this template</button>
      </div>

      <!-- New playbook card -->
      <button
        style="padding:18px;border:1.5px dashed var(--line-strong);border-radius:var(--radius-lg);background:transparent;color:var(--ink-2);min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:border-color .12s,background .12s;width:100%;"
        @mouseenter="(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-soft)'; }"
        @mouseleave="(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line-strong)'; (e.currentTarget as HTMLElement).style.background = ''; }"
      >
        <span style="width:44px;height:44px;border-radius:12px;background:var(--bg-sunk);display:inline-flex;align-items:center;justify-content:center;">
          <Plus :size="20" />
        </span>
        <div class="nx-h-heading">Build from scratch</div>
        <div style="font-size:12px;color:var(--muted);text-align:center;max-width:200px;">Chain agents, approvals, and triggers into a workflow.</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus, Workflow } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const samples = [
  { title: 'Weekly social rhythm', desc: 'Monday plan → drafts mid-week → publish Fri', steps: ['Researcher: trends', 'Writer: 3 drafts', 'Social: schedule'] },
  { title: 'New product launch', desc: 'Coordinated Meta + email + landing', steps: ['Writer: copy', 'Social: posts', 'Email: campaign'] },
  { title: 'Monthly recap', desc: 'Numbers, wins, what\'s next', steps: ['Research: pull metrics', 'Writer: narrative', 'Send for approval'] },
  { title: 'Influencer outreach', desc: 'Find, qualify, and pitch creators', steps: ['Researcher: find 10 candidates', 'Writer: draft pitch', 'Approve & send'] },
]
</script>
