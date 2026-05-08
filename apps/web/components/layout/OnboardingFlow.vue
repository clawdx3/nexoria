<template>
  <Transition name="nx-fade">
    <div v-if="open" style="position:fixed;inset:0;background:var(--bg);z-index:200;display:flex;flex-direction:column;">

      <!-- Header with progress -->
      <div style="padding:16px 24px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;flex-shrink:0;">
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;">
          <span style="width:22px;height:22px;border-radius:6px;background:var(--ink);color:var(--bg);display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;">N</span>
          Nexoria
        </span>
        <div style="flex:1;display:flex;gap:4px;margin-left:16px;">
          <div
            v-for="n in 5"
            :key="n"
            style="flex:1;height:3px;border-radius:999px;transition:background .2s;"
            :style="{ background: step >= n - 1 ? 'var(--accent)' : 'var(--bg-sunk)' }"
          />
        </div>
        <button style="font-size:12px;color:var(--muted);background:none;border:none;cursor:pointer;padding:4px 8px;" @click="dismiss">
          Skip setup
        </button>
      </div>

      <!-- Step content -->
      <div style="flex:1;overflow-y:auto;padding:32px 24px;">

        <!-- Step 0: Welcome -->
        <div v-if="step === 0" style="max-width:520px;margin:0 auto;text-align:center;padding-top:40px;">
          <div style="width:72px;height:72px;border-radius:18px;background:var(--accent-soft);color:var(--accent-soft-ink);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
            <Sparkles :size="28" />
          </div>
          <div class="nx-h-display" style="margin-bottom:14px;">Welcome to Nexoria.</div>
          <div style="font-size:15px;color:var(--muted);margin-bottom:28px;line-height:1.6;max-width:400px;margin-left:auto;margin-right:auto;">
            You're about to hire your first AI team. We'll spend two minutes learning your business, then you can start delegating.
          </div>
          <button class="nx-btn nx-btn-accent" style="font-size:15px;padding:12px 28px;" @click="step = 1">
            Let's go <ArrowRight :size="14" />
          </button>
          <div style="font-size:12px;color:var(--muted);margin-top:14px;">You'll need to connect at least one tool (like Instagram). We'll guide you.</div>
        </div>

        <!-- Step 1: Business info -->
        <div v-if="step === 1" style="max-width:540px;margin:0 auto;">
          <div class="nx-h-display" style="margin-bottom:8px;">Tell us about your business</div>
          <div style="font-size:14px;color:var(--muted);margin-bottom:28px;">This becomes shared memory — every agent will know it.</div>
          <div style="display:flex;flex-direction:column;gap:18px;">
            <div>
              <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">What's your business called?</label>
              <input
                v-model="biz.name"
                class="nx-input"
                placeholder="e.g. Studio Vukov"
                style="font-size:16px;"
              />
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:8px;">What do you do?</label>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">
                <button
                  v-for="c in categories"
                  :key="c"
                  style="padding:12px 14px;border-radius:10px;text-align:left;font-size:13.5px;font-weight:500;cursor:pointer;transition:border-color .12s,background .12s;"
                  :style="{
                    border: '1px solid ' + (biz.category === c ? 'var(--accent)' : 'var(--line)'),
                    background: biz.category === c ? 'var(--accent-soft)' : 'var(--bg-elev)',
                    color: biz.category === c ? 'var(--accent-soft-ink)' : 'var(--ink)',
                  }"
                  @click="biz.category = c"
                >{{ c }}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Brand voice -->
        <div v-if="step === 2" style="max-width:620px;margin:0 auto;">
          <div class="nx-h-display" style="margin-bottom:8px;">How do you sound?</div>
          <div style="font-size:14px;color:var(--muted);margin-bottom:28px;">Pick the closest match — you can refine the brand voice later.</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
            <button
              v-for="v in voiceOpts"
              :key="v.id"
              style="padding:18px;border-radius:12px;text-align:left;cursor:pointer;transition:border-color .12s,background .12s;"
              :style="{
                border: '1.5px solid ' + (voice === v.id ? 'var(--accent)' : 'var(--line)'),
                background: voice === v.id ? 'var(--accent-soft)' : 'var(--bg-elev)',
              }"
              @click="voice = v.id"
            >
              <div style="font-size:14px;font-weight:600;margin-bottom:6px;">{{ v.label }}</div>
              <div style="font-size:13px;color:var(--ink-2);font-style:italic;">"{{ v.sample }}"</div>
            </button>
          </div>
        </div>

        <!-- Step 3: Goals -->
        <div v-if="step === 3" style="max-width:620px;margin:0 auto;">
          <div class="nx-h-display" style="margin-bottom:8px;">What should they help with?</div>
          <div style="font-size:14px;color:var(--muted);margin-bottom:28px;">Pick everything that fits — we'll set up matching agents.</div>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button
              v-for="g in goalOpts"
              :key="g.id"
              style="padding:16px;border-radius:12px;display:flex;align-items:center;gap:14px;text-align:left;cursor:pointer;transition:border-color .12s,background .12s;"
              :style="{
                border: '1.5px solid ' + (goals.has(g.id) ? 'var(--accent)' : 'var(--line)'),
                background: goals.has(g.id) ? 'var(--accent-soft)' : 'var(--bg-elev)',
              }"
              @click="toggleGoal(g.id)"
            >
              <span
                style="width:24px;height:24px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .12s,border-color .12s;"
                :style="{
                  background: goals.has(g.id) ? 'var(--accent)' : 'transparent',
                  border: '1.5px solid ' + (goals.has(g.id) ? 'var(--accent)' : 'var(--line-strong)'),
                }"
              >
                <Check v-if="goals.has(g.id)" :size="14" style="color:white;" />
              </span>
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:600;margin-bottom:3px;">{{ g.label }}</div>
                <div style="font-size:12px;color:var(--muted);">{{ g.desc }}</div>
              </div>
            </button>
          </div>
        </div>

        <!-- Step 4: Meet your team -->
        <div v-if="step === 4" style="max-width:700px;margin:0 auto;">
          <div class="nx-h-display" style="margin-bottom:8px;">Meet your team</div>
          <div style="font-size:14px;color:var(--muted);margin-bottom:28px;">Based on what you picked, we suggest these agents. You can edit them anytime.</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px;">
            <button
              v-for="a in suggestedAgents"
              :key="a.id"
              style="padding:16px;border-radius:12px;display:flex;gap:12px;align-items:flex-start;text-align:left;cursor:pointer;transition:border-color .12s,background .12s;"
              :style="{
                border: '1.5px solid ' + (picked.has(a.id) ? 'var(--accent)' : 'var(--line)'),
                background: picked.has(a.id) ? 'var(--accent-soft)' : 'var(--bg-elev)',
              }"
              @click="togglePicked(a.id)"
            >
              <NxAvatar :name="a.name" :color="a.color" size="lg" />
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                  <span class="nx-h-heading">{{ a.name }}</span>
                  <Check v-if="picked.has(a.id)" :size="14" style="color:var(--accent-soft-ink);" />
                </div>
                <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">{{ a.role }}</div>
                <div style="font-size:12px;color:var(--ink-2);">{{ a.desc }}</div>
              </div>
            </button>
          </div>

          <div style="padding:16px;background:var(--bg-sunk);border-radius:12px;display:flex;gap:14px;align-items:flex-start;">
            <span style="width:32px;height:32px;border-radius:8px;background:var(--info-soft);color:var(--info);display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
              <Plug :size="15" />
            </span>
            <div style="flex:1;">
              <div style="font-size:13.5px;font-weight:600;margin-bottom:2px;">One last thing — connect a tool</div>
              <div style="font-size:12px;color:var(--muted);">Your agents need somewhere to do work. Pick one to start; you can add more in Settings → Plugins.</div>
            </div>
          </div>
        </div>

      </div>

      <!-- Footer nav (not shown on step 0) -->
      <div v-if="step > 0" style="padding:18px;border-top:1px solid var(--line);display:flex;justify-content:space-between;max-width:700px;margin:0 auto;width:100%;box-sizing:border-box;flex-shrink:0;">
        <button class="nx-btn nx-btn-ghost" @click="step = Math.max(0, step - 1)">Back</button>
        <button v-if="step < 4" class="nx-btn nx-btn-accent" @click="step++">
          Continue <ArrowRight :size="13" />
        </button>
        <button v-else class="nx-btn nx-btn-accent" @click="dismiss">
          Open Nexoria <ArrowRight :size="13" />
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Sparkles, ArrowRight, Check, Plug } from 'lucide-vue-next'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const step = ref(0)

const biz = reactive({ name: '', category: 'Retail / e-commerce' })
const voice = ref('warm')
const goals = ref(new Set<string>(['social', 'support']))
const picked = ref(new Set<string>(['social', 'writer']))

const categories = [
  'Retail / e-commerce', 'Services / agency',
  'Creator / personal brand', 'Restaurant / hospitality',
  'B2B / SaaS', 'Something else',
]

const voiceOpts = [
  { id: 'warm', label: 'Warm & friendly', sample: 'Hey friend! New drop\'s live ✨' },
  { id: 'pro', label: 'Professional & clean', sample: 'Our latest collection is now available.' },
  { id: 'playful', label: 'Playful & punchy', sample: 'Yes. It\'s here. Go look. 👀' },
  { id: 'expert', label: 'Expert & informative', sample: 'We\'ve reformulated based on 8 weeks of testing.' },
]

const goalOpts = [
  { id: 'social', label: 'Grow on social', desc: 'Post regularly, engage, run small ads' },
  { id: 'support', label: 'Handle DMs & emails', desc: 'Reply to customers in your voice' },
  { id: 'content', label: 'Write content', desc: 'Newsletters, blog, product copy' },
  { id: 'research', label: 'Research & insights', desc: 'Watch competitors, summarize' },
]

const suggestedAgents = [
  { id: 'social', name: 'Social Media', role: 'Content & scheduling', desc: 'Posts to Instagram, Facebook, X. Knows your brand voice.', color: '#C25B3F' },
  { id: 'writer', name: 'Writer', role: 'Copy & content', desc: 'Newsletters, blog posts, product descriptions, captions.', color: '#7C5CC2' },
  { id: 'researcher', name: 'Researcher', role: 'Insights & analysis', desc: 'Competitor sweeps, trend summaries, audience research.', color: '#3F8FC2' },
  { id: 'support', name: 'Support', role: 'DMs & customer care', desc: 'Drafts replies to customer messages in your tone.', color: '#5C9C6E' },
]

function toggleGoal (id: string) {
  const s = new Set(goals.value)
  s.has(id) ? s.delete(id) : s.add(id)
  goals.value = s
}

function togglePicked (id: string) {
  const s = new Set(picked.value)
  s.has(id) ? s.delete(id) : s.add(id)
  picked.value = s
}

function dismiss () {
  if (import.meta.client) localStorage.setItem('nx-onboarded', '1')
  emit('close')
}
</script>
