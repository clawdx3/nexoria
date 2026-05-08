<template>
  <div class="nx-page-wide">

    <div style="margin-bottom:24px;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;">
      <div>
        <div class="text-tiny" style="margin-bottom:6px;">Build</div>
        <div class="nx-h-display">Plugins & Integrations</div>
        <div style="font-size:13px;color:var(--muted);margin-top:6px;max-width:600px;">Connect the tools you already use. Each plugin unlocks tools your agents can call. We use OAuth — your password never touches us.</div>
      </div>
      <button class="nx-btn nx-btn-ghost"><Plus :size="13" /> Request a plugin</button>
    </div>

    <!-- Connected -->
    <div v-if="connectedIntegrations.length > 0" style="margin-bottom:28px;">
      <div class="text-tiny" style="margin-bottom:10px;">Connected · {{ connectedIntegrations.length }}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;">
        <button
          v-for="item in connectedIntegrations"
          :key="item.id"
          class="nx-surface"
          style="padding:12px;display:flex;align-items:center;gap:10px;text-align:left;cursor:pointer;"
          @click="openOAuth(item)"
        >
          <div style="width:32px;height:32px;border-radius:8px;overflow:hidden;flex-shrink:0;" v-html="brandLogo(item.provider)" />
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.name || item.provider }}</div>
            <div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ item.accountName || item.accountId || 'Connected' }} · {{ item.lastUsed || 'Active' }}</div>
          </div>
          <span class="nx-tag ok dot">on</span>
        </button>
      </div>
    </div>

    <!-- Category filter -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div class="nx-seg">
        <button :class="{ on: catFilter === 'all' }" @click="catFilter = 'all'">Browse all</button>
        <button v-for="c in categories" :key="c" :class="{ on: catFilter === c }" @click="catFilter = c">{{ c }}</button>
      </div>
    </div>

    <!-- Plugin cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">
      <div v-for="item in filteredPlugins" :key="item.id" class="nx-surface" style="padding:16px;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="width:40px;height:40px;border-radius:10px;overflow:hidden;flex-shrink:0;" v-html="brandLogo(item.provider)" />
          <div style="flex:1;min-width:0;">
            <div class="nx-h-heading">{{ item.name }}</div>
            <div style="font-size:11px;color:var(--muted);">{{ item.category }}</div>
          </div>
          <span v-if="item.connected" class="nx-tag ok dot">connected</span>
        </div>
        <div style="font-size:13px;color:var(--ink-2);flex:1;min-height:36px;">{{ item.desc }}</div>
        <button
          class="nx-btn nx-btn-sm"
          :class="item.connected ? 'nx-btn-soft' : 'nx-btn-accent'"
          @click="openOAuth(item)"
        >
          <Settings v-if="item.connected" :size="12" /> Manage
          <Link v-else :size="12" /> Connect
        </button>
      </div>
    </div>

    <!-- OAuth Modal -->
    <template v-if="oauthItem">
      <div class="nx-scrim" @click="oauthItem = null" />
      <div class="nx-modal" style="width:520px;">
        <div style="padding:14px 22px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:12px;">
          <div style="width:30px;height:30px;border-radius:8px;overflow:hidden;flex-shrink:0;" v-html="brandLogo(oauthItem.provider)" />
          <div style="flex:1;">
            <div class="text-tiny" style="margin-bottom:2px;">Connect plugin</div>
            <div class="nx-h-heading">{{ oauthItem.name }}</div>
          </div>
          <button class="nx-icon-btn" @click="oauthItem = null; oauthStep = 1"><X :size="16" /></button>
        </div>

        <!-- Progress -->
        <div style="display:flex;gap:6px;padding:12px 22px 0;">
          <div v-for="n in 4" :key="n" style="flex:1;height:3px;border-radius:999px;transition:background .2s;" :style="{ background: oauthStep >= n ? 'var(--accent)' : 'var(--bg-sunk)' }" />
        </div>

        <div style="min-height:280px;">
          <!-- Step 1: Connecting -->
          <div v-if="oauthStep === 1" style="padding:36px;text-align:center;">
            <div style="width:56px;height:56px;border-radius:16px;background:var(--accent-soft);color:var(--accent-soft-ink);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
              <Link2 :size="24" />
            </div>
            <div class="nx-h-title" style="margin-bottom:6px;">Opening {{ oauthItem.name }}…</div>
            <div style="font-size:13px;color:var(--muted);">A secure popup will ask you to authorize Nexoria. We don't see your password.</div>
          </div>

          <!-- Step 2: Pick account -->
          <div v-if="oauthStep === 2">
            <div style="padding:20px 22px 8px;">
              <div class="nx-h-title" style="margin-bottom:4px;">Pick the account</div>
              <div style="font-size:13px;color:var(--muted);">Connect only what this workspace needs.</div>
            </div>
            <div style="padding:8px 22px 22px;display:flex;flex-direction:column;gap:8px;">
              <button
                v-for="p in oauthAccounts"
                :key="p.id"
                style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;text-align:left;cursor:pointer;"
                :style="{ border: '1px solid ' + (oauthAccount === p.id ? 'var(--accent)' : 'var(--line)'), background: oauthAccount === p.id ? 'var(--accent-soft)' : 'var(--bg-elev)' }"
                @click="oauthAccount = p.id"
              >
                <div style="width:28px;height:28px;border-radius:7px;overflow:hidden;flex-shrink:0;" v-html="brandLogo(oauthItem!.provider)" />
                <div style="flex:1;">
                  <div style="font-size:13.5px;font-weight:600;">{{ p.name }}</div>
                  <div style="font-size:11px;color:var(--muted);">{{ p.sub }}</div>
                </div>
                <span style="width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;"
                  :style="{ border: '1.5px solid ' + (oauthAccount === p.id ? 'var(--accent)' : 'var(--line-strong)'), background: oauthAccount === p.id ? 'var(--accent)' : 'transparent' }"
                >
                  <Check v-if="oauthAccount === p.id" :size="11" style="color:white;" />
                </span>
              </button>
            </div>
          </div>

          <!-- Step 3: Scopes -->
          <div v-if="oauthStep === 3">
            <div style="padding:20px 22px 8px;">
              <div class="nx-h-title" style="margin-bottom:4px;">Confirm what Nexoria can do</div>
              <div style="font-size:13px;color:var(--muted);">Toggle off anything you don't want. You can change these later.</div>
            </div>
            <div style="padding:8px 22px 22px;display:flex;flex-direction:column;gap:8px;">
              <div
                v-for="s in oauthScopes"
                :key="s.id"
                style="padding:12px;border:1px solid var(--line);border-radius:10px;display:flex;gap:12px;align-items:flex-start;"
              >
                <span style="width:28px;height:28px;border-radius:7px;background:var(--bg-sunk);display:inline-flex;align-items:center;justify-content:center;color:var(--ink-2);flex-shrink:0;">
                  <Lock :size="13" />
                </span>
                <div style="flex:1;">
                  <div style="font-size:13.5px;font-weight:600;">{{ s.label }}</div>
                  <div style="font-size:11px;color:var(--muted);">{{ s.desc }}</div>
                </div>
                <button class="nx-switch on"><span class="nx-switch-thumb" /></button>
              </div>
            </div>
          </div>

          <!-- Step 4: Done -->
          <div v-if="oauthStep === 4" style="padding:36px;text-align:center;">
            <div style="width:56px;height:56px;border-radius:16px;background:var(--ok-soft);color:var(--ok);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
              <Check :size="24" />
            </div>
            <div class="nx-h-title" style="margin-bottom:6px;">{{ oauthItem.name }} connected</div>
            <div style="font-size:13px;color:var(--muted);max-width:320px;margin:0 auto 16px;">
              New tools are now available to your agents.
            </div>
            <button class="nx-btn nx-btn-accent" @click="oauthItem = null; oauthStep = 1">Done</button>
          </div>
        </div>

        <div v-if="oauthStep !== 4" style="padding:14px;border-top:1px solid var(--line);display:flex;justify-content:space-between;">
          <button class="nx-btn nx-btn-ghost" @click="oauthItem = null; oauthStep = 1">Cancel</button>
          <button
            class="nx-btn nx-btn-accent"
            :disabled="oauthStep === 2 && !oauthAccount"
            @click="nextOauthStep"
          >
            {{ oauthStep === 1 ? 'I authorized' : oauthStep === 3 ? 'Confirm & connect' : 'Continue' }}
            <ArrowRight :size="13" />
          </button>
        </div>
      </div>
    </template>

  </div>
</template>

<script setup lang="ts">
import { Plus, Settings, Link, X, Check, ArrowRight, Lock } from 'lucide-vue-next'
import { Link as Link2 } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const { integrations, fetchIntegrations } = useIntegrations()
onMounted(() => { void fetchIntegrations() })

const catFilter = ref('all')
const categories = ['Social', 'Productivity', 'Commerce', 'Marketing']

const allPlugins = computed(() => {
  const realOnes = (integrations.value || []).map((i: any) => ({
    id: i.id, name: i.name || i.provider, provider: i.provider, category: i.category || 'Other',
    desc: i.description || `Connect ${i.provider}`, connected: i.isConnected,
    accountName: i.accountName, accountId: i.accountId, lastUsed: i.lastUsed,
  }))
  const builtIn = [
    { id: 'meta', name: 'Meta — Facebook & Instagram', provider: 'meta', category: 'Social', desc: 'Publish posts, read insights, run ads.', connected: false },
    { id: 'google', name: 'Google Workspace', provider: 'google', category: 'Productivity', desc: 'Gmail, Calendar, Drive.', connected: false },
    { id: 'shopify', name: 'Shopify', provider: 'shopify', category: 'Commerce', desc: 'Products, orders, inventory.', connected: false },
    { id: 'mailerlite', name: 'MailerLite', provider: 'mailerlite', category: 'Marketing', desc: 'Campaigns, subscribers, automations.', connected: false },
    { id: 'x', name: 'X (Twitter)', provider: 'x', category: 'Social', desc: 'Post, schedule, read mentions.', connected: false },
    { id: 'linkedin', name: 'LinkedIn', provider: 'linkedin', category: 'Social', desc: 'Company page posts.', connected: false },
    { id: 'notion', name: 'Notion', provider: 'notion', category: 'Productivity', desc: 'Read pages, write back notes.', connected: false },
    { id: 'slack', name: 'Slack', provider: 'slack', category: 'Productivity', desc: 'Notifications and team handoff.', connected: false },
  ]
  // Merge: real ones take priority over built-in
  const realIds = new Set(realOnes.map((r) => r.provider))
  return [...realOnes, ...builtIn.filter((b) => !realIds.has(b.provider))]
})

const connectedIntegrations = computed(() => allPlugins.value.filter((i) => i.connected))
const filteredPlugins = computed(() => {
  if (catFilter.value === 'all') return allPlugins.value
  return allPlugins.value.filter((i) => i.category === catFilter.value)
})

// OAuth modal
const oauthItem = ref<any>(null)
const oauthStep = ref(1)
const oauthAccount = ref('')

const oauthAccounts = computed(() => {
  if (!oauthItem.value) return []
  if (oauthItem.value.provider === 'meta') return [
    { id: 'p1', name: 'Studio Vukov', sub: 'Page · Instagram connected' },
    { id: 'p2', name: 'Studio Vukov DE', sub: 'Page only' },
  ]
  if (oauthItem.value.provider === 'google') return [
    { id: 'p1', name: 'me@studio.co', sub: 'Workspace · primary' },
    { id: 'p2', name: 'me@personal.com', sub: 'Personal' },
  ]
  return [{ id: 'p1', name: 'Default account', sub: 'Primary' }]
})

const oauthScopes = computed(() => {
  if (!oauthItem.value) return []
  if (oauthItem.value.provider === 'meta') return [
    { id: 'pages_manage_posts', label: 'Manage posts on your Pages', desc: 'Create, edit and delete posts on Pages you admin.' },
    { id: 'pages_read_engagement', label: 'Read engagement', desc: 'See likes, comments and reach.' },
    { id: 'instagram_content_publish', label: 'Publish to Instagram', desc: 'Post photos, carousels and reels.' },
  ]
  if (oauthItem.value.provider === 'google') return [
    { id: 'gmail.modify', label: 'Read & draft Gmail', desc: 'Read messages and create drafts. Never sends without your approval.' },
    { id: 'calendar.events', label: 'Calendar events', desc: 'Create and edit events on calendars you select.' },
  ]
  return [
    { id: 'default.read', label: 'Read your data', desc: 'Read-only access.' },
    { id: 'default.write', label: 'Write your data', desc: 'Create and modify resources.' },
  ]
})

function openOAuth (item: any) {
  oauthItem.value = item
  oauthStep.value = 1
  oauthAccount.value = ''
}

function nextOauthStep () {
  if (oauthStep.value < 4) oauthStep.value++
}

// Brand logos (inline SVG)
function brandLogo (provider: string): string {
  const logos: Record<string, string> = {
    meta: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#1877F2"/><path fill="#fff" d="M19 22h-2v-7h-2v-2h2v-1.5C17 9.6 18 9 20 9h2v2h-1.5c-.8 0-.5.5-.5 1v1H22l-.4 2H20v7Z"/></svg>`,
    google: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#fff"/><path fill="#4285F4" d="M24.5 16.2c0-.6 0-1.1-.1-1.7H16v3.2h4.8c-.2 1.1-.8 2-1.7 2.6v2.2h2.8c1.6-1.5 2.6-3.7 2.6-6.3z"/><path fill="#34A853" d="M16 25c2.3 0 4.3-.8 5.7-2.1l-2.8-2.2c-.8.5-1.8.9-2.9.9-2.2 0-4.1-1.5-4.8-3.5h-2.9v2.2C9.7 22.9 12.6 25 16 25z"/><path fill="#FBBC05" d="M11.2 18.1c-.2-.5-.3-1.1-.3-1.6s.1-1.1.3-1.6V12.6h-2.9c-.6 1.2-1 2.5-1 3.9s.4 2.7 1 3.9l2.9-2.3z"/><path fill="#EA4335" d="M16 11.4c1.3 0 2.4.4 3.3 1.3l2.5-2.4C20.3 8.9 18.3 8 16 8c-3.4 0-6.3 2.1-7.7 4.6l2.9 2.2c.7-2 2.6-3.4 4.8-3.4z"/></svg>`,
    shopify: `<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#95BF47"/><path fill="#fff" d="M19.5 11.5c-.3-.3-1-.5-1.5-.5-1.5 0-2 1-2 1V11c-1 0-2 .7-2 2l-1.7 9 8 1.5L21 13c-.5-.3-1.2-1.2-1.5-1.5z"/></svg>`,
    mailerlite: `<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#00B5BB"/><path d="M8 11l8 6 8-6v11H8V11z" fill="#fff"/></svg>`,
    x: `<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#000"/><path fill="#fff" d="m18.6 14.2 5.6-6.4h-1.4l-4.9 5.6L14 7.8H8.7l5.9 8.4-5.9 6.7H10l5.1-5.9 4.1 5.9h5.3l-6-8.7zm-1.8 2L11 9h2.2l8.7 12.4h-2.2L16.8 16.2z"/></svg>`,
    linkedin: `<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0A66C2"/><path fill="#fff" d="M11 12H9v9h2v-9zm-1-2.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4zM23 21h-2v-4.5c0-1.1-.5-1.7-1.4-1.7-.8 0-1.3.5-1.5 1.1v5.1h-2v-9h2v1c.4-.6 1.1-1.2 2.4-1.2 1.7 0 2.5 1.1 2.5 3v6.2z"/></svg>`,
    notion: `<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#fff" stroke="#E5E5E5"/><path fill="#000" d="M9 9.5 21 9l1.5 1.5V22l-1 .8L10 22V11l-1-1.5z"/></svg>`,
    slack: `<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#4A154B"/><circle cx="12" cy="12" r="2" fill="#36C5F0"/><circle cx="20" cy="12" r="2" fill="#2EB67D"/><circle cx="20" cy="20" r="2" fill="#ECB22E"/><circle cx="12" cy="20" r="2" fill="#E01E5A"/></svg>`,
    stripe: `<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#635BFF"/><path fill="#fff" d="M14.5 13.5c0-.6.5-.8 1.3-.8 1.2 0 2.6.4 3.7 1V10c-1.2-.5-2.5-.7-3.7-.7-3 0-5 1.5-5 4 0 4 5.4 3.4 5.4 5.1 0 .7-.6.9-1.5.9-1.3 0-3-.5-4.3-1.2v3.5c1.4.6 2.9.9 4.4.9 3.1 0 5.2-1.5 5.2-4 0-4.3-5.5-3.6-5.5-5z"/></svg>`,
  }
  return logos[provider] || `<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="var(--bg-sunk)"/></svg>`
}
</script>
