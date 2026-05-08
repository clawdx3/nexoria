<template>
  <div class="nx-page-wide">

    <!-- Page header -->
    <div style="margin-bottom:24px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <div class="text-tiny" style="margin-bottom:6px;">Build</div>
        <div class="nx-h-display">Agents</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px;max-width:580px;">The team working for you. Each agent gets its own model, tools, and autonomy level. Build new ones — no code required.</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="nx-btn nx-btn-ghost">
          <Globe :size="13" /> Browse marketplace
        </button>
        <button class="nx-btn nx-btn-accent" @click="openBuilder(null)">
          <Plus :size="13" /> New agent
        </button>
      </div>
    </div>

    <div v-if="isLoading" style="padding:40px;text-align:center;color:var(--muted);font-size:13px;">Loading…</div>

    <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;">
      <div v-for="a in agents" :key="a.id" class="nx-surface" style="padding:18px;">
        <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
          <NxAvatar :name="a.name" :color="agentColor(a)" size="lg" />
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
              <span class="nx-h-heading">{{ a.name }}</span>
            </div>
            <div style="font-size:12px;color:var(--muted);">{{ a.role || 'Agent' }}</div>
          </div>
          <button class="nx-switch" :class="{ on: a.isEnabled !== false }" @click="a.isEnabled = !a.isEnabled">
            <span class="nx-switch-thumb" />
          </button>
        </div>
        <div style="font-size:13px;color:var(--ink-2);margin-bottom:14px;min-height:40px;line-height:1.5;">{{ a.description || 'No description.' }}</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
          <div style="padding:8px 10px;background:var(--bg-sunk);border-radius:8px;">
            <div style="font-size:11px;color:var(--muted);margin-bottom:2px;">Model</div>
            <div style="font-size:13px;font-weight:500;font-family:var(--font-mono);">{{ (a.model || 'claude-sonnet-4').replace('claude-', '') }}</div>
          </div>
          <div style="padding:8px 10px;background:var(--bg-sunk);border-radius:8px;">
            <div style="font-size:11px;color:var(--muted);margin-bottom:2px;">Autonomy</div>
            <div style="font-size:13px;font-weight:500;">Level {{ a.autonomyLevel ?? 1 }}</div>
          </div>
        </div>

        <div style="display:flex;gap:6px;">
          <button class="nx-btn nx-btn-ghost nx-btn-sm" style="flex:1;" @click="openBuilder(a)">
            <Edit :size="12" /> Edit
          </button>
          <button class="nx-btn nx-btn-soft nx-btn-sm" style="flex:1;" @click="navigateTo(`/chat/${a.id}`)">
            <MessageSquare :size="12" /> Chat
          </button>
        </div>
      </div>

      <!-- Create card -->
      <button
        style="padding:18px;border:1.5px dashed var(--line-strong);border-radius:var(--radius-lg);background:transparent;color:var(--ink-2);min-height:270px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:border-color .12s,background .12s;width:100%;"
        @mouseenter="(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-soft)'; }"
        @mouseleave="(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line-strong)'; (e.currentTarget as HTMLElement).style.background = ''; }"
        @click="openBuilder(null)"
      >
        <span style="width:44px;height:44px;border-radius:12px;background:var(--bg-sunk);display:inline-flex;align-items:center;justify-content:center;">
          <Plus :size="20" />
        </span>
        <div class="nx-h-heading">Build a custom agent</div>
        <div style="font-size:12px;color:var(--muted);text-align:center;max-width:220px;">Pick a model, write a brief — no code needed.</div>
      </button>
    </div>

    <!-- Agent Builder Drawer -->
    <template v-if="builderOpen">
      <div class="nx-scrim" @click="builderOpen = false" />
      <div class="nx-drawer">
        <div style="padding:16px 22px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div class="text-tiny" style="margin-bottom:2px;">{{ builderAgent ? 'Edit agent' : 'New agent' }}</div>
            <div class="nx-h-title">{{ builderForm.name || 'Untitled agent' }}</div>
          </div>
          <button class="nx-icon-btn" @click="builderOpen = false"><X :size="16" /></button>
        </div>

        <div style="display:flex;padding:12px 22px;gap:24px;border-bottom:1px solid var(--line);">
          <button
            v-for="(s, idx) in ['Identity', 'Model & Autonomy']"
            :key="s"
            style="display:flex;align-items:center;gap:8px;padding:6px 0;font-weight:500;font-size:13px;"
            :style="{
              borderBottom: builderStep === idx + 1 ? '2px solid var(--accent)' : '2px solid transparent',
              color: builderStep === idx + 1 ? 'var(--ink)' : 'var(--muted)',
            }"
            @click="builderStep = idx + 1"
          >
            <span style="width:18px;height:18px;border-radius:50%;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;"
              :style="builderStep >= idx + 1 ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : { background: 'var(--bg-sunk)', color: 'var(--muted)' }"
            >{{ idx + 1 }}</span>
            {{ s }}
          </button>
        </div>

        <div style="flex:1;overflow-y:auto;padding:22px;">
          <div v-if="builderStep === 1" style="display:flex;flex-direction:column;gap:16px;">
            <div>
              <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">Name</label>
              <input v-model="builderForm.name" class="nx-input" placeholder="e.g. Customer Care" />
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">What this agent does</label>
              <textarea v-model="builderForm.description" class="nx-input" rows="4" placeholder="Replies to customer DMs and emails in our brand voice." />
              <div style="font-size:11px;color:var(--muted);margin-top:6px;">We'll turn this into the system prompt — you don't need to write one.</div>
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:8px;">Avatar color</label>
              <div style="display:flex;gap:8px;">
                <button
                  v-for="c in ['#C25B3F','#7C5CC2','#3F8FC2','#5C9C6E','#C29A3F','#C23F8C']"
                  :key="c"
                  style="width:28px;height:28px;border-radius:8px;border:2px solid var(--bg-elev);"
                  :style="{ background: c, boxShadow: builderForm.color === c ? '0 0 0 2px var(--accent)' : '0 0 0 1px var(--line)' }"
                  @click="builderForm.color = c"
                />
              </div>
            </div>
          </div>

          <div v-if="builderStep === 2" style="display:flex;flex-direction:column;gap:16px;">
            <div>
              <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:8px;">Model</label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button
                  v-for="m in [{ id: 'claude-sonnet-4', name: 'Claude Sonnet 4', note: 'Recommended · balanced' }, { id: 'claude-opus-4', name: 'Claude Opus 4', note: 'Best reasoning' }, { id: 'claude-haiku-4', name: 'Claude Haiku 4', note: 'Fast · low cost' }]"
                  :key="m.id"
                  style="padding:12px;text-align:left;border-radius:10px;cursor:pointer;"
                  :style="{ border: '1px solid ' + (builderForm.model === m.id ? 'var(--accent)' : 'var(--line)'), background: builderForm.model === m.id ? 'var(--accent-soft)' : 'var(--bg-elev)' }"
                  @click="builderForm.model = m.id"
                >
                  <div style="font-size:13px;font-weight:600;margin-bottom:2px;">{{ m.name }}</div>
                  <div style="font-size:11px;color:var(--muted);">{{ m.note }}</div>
                </button>
              </div>
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:8px;">Autonomy level</label>
              <div style="display:flex;flex-direction:column;gap:8px;">
                <button
                  v-for="lv in [{ level: 0, label: 'Suggest only', desc: 'Always asks before doing anything.' }, { level: 1, label: 'Approve risky', desc: 'Spending and public posts need approval.' }, { level: 2, label: 'Approve high-risk', desc: 'Only high spend and external sends.' }, { level: 3, label: 'Full auto', desc: 'Acts on its own. Use with care.' }]"
                  :key="lv.level"
                  style="display:flex;gap:12px;padding:12px;border-radius:10px;text-align:left;align-items:flex-start;cursor:pointer;"
                  :style="{ border: '1px solid ' + (builderForm.autonomyLevel === lv.level ? 'var(--accent)' : 'var(--line)'), background: builderForm.autonomyLevel === lv.level ? 'var(--accent-soft)' : 'var(--bg-elev)' }"
                  @click="builderForm.autonomyLevel = lv.level"
                >
                  <span style="width:22px;height:22px;border-radius:50%;font-weight:700;font-size:11px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;"
                    :style="builderForm.autonomyLevel === lv.level ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : { background: 'var(--bg-sunk)', color: 'var(--ink-2)' }"
                  >{{ lv.level }}</span>
                  <div>
                    <div style="font-size:13.5px;font-weight:600;">{{ lv.label }}</div>
                    <div style="font-size:12px;color:var(--muted);">{{ lv.desc }}</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style="padding:16px;border-top:1px solid var(--line);display:flex;justify-content:space-between;">
          <button class="nx-btn nx-btn-ghost" @click="builderOpen = false">Cancel</button>
          <div style="display:flex;gap:8px;">
            <button v-if="builderStep > 1" class="nx-btn nx-btn-soft" @click="builderStep--">Back</button>
            <button v-if="builderStep < 2" class="nx-btn nx-btn-accent" @click="builderStep++">Next <ArrowRight :size="13" /></button>
            <button v-else class="nx-btn nx-btn-accent" :disabled="saving" @click="saveAgent">
              <Check :size="13" /> {{ builderAgent ? 'Save' : 'Create agent' }}
            </button>
          </div>
        </div>
      </div>
    </template>

  </div>
</template>

<script setup lang="ts">
import { Plus, Globe, Edit, MessageSquare, X, ArrowRight, Check } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const { agents, isLoading, fetchAgents, createAgent, updateAgent } = useAgent()
onMounted(() => { void fetchAgents() })

const agentColorPalette = ['#C25B3F', '#7C5CC2', '#3F8FC2', '#5C9C6E', '#C29A3F', '#C23F8C']
function agentColor (a: any): string {
  if (a.metadata?.color) return a.metadata.color
  return agentColorPalette[(a.name || '').charCodeAt(0) % agentColorPalette.length]
}

const builderOpen = ref(false)
const builderAgent = ref<any>(null)
const builderStep = ref(1)
const saving = ref(false)
const builderForm = reactive({ name: '', description: '', color: '#C25B3F', model: 'claude-sonnet-4', autonomyLevel: 1 })

function openBuilder (agent: any) {
  builderAgent.value = agent
  builderStep.value = 1
  if (agent) {
    Object.assign(builderForm, {
      name: agent.name || '',
      description: agent.description || '',
      color: agent.metadata?.color || '#C25B3F',
      model: agent.model || 'claude-sonnet-4',
      autonomyLevel: agent.autonomyLevel ?? 1,
    })
  } else {
    Object.assign(builderForm, { name: '', description: '', color: '#C25B3F', model: 'claude-sonnet-4', autonomyLevel: 1 })
  }
  builderOpen.value = true
}

async function saveAgent () {
  saving.value = true
  try {
    const payload = {
      name: builderForm.name,
      description: builderForm.description,
      model: builderForm.model,
      autonomyLevel: builderForm.autonomyLevel,
      metadata: { color: builderForm.color },
    }
    if (builderAgent.value?.id) {
      await updateAgent(builderAgent.value.id, payload)
    } else {
      await createAgent(payload)
    }
    builderOpen.value = false
  } finally {
    saving.value = false
  }
}
</script>
