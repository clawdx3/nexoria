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

    <div v-else>
      <!-- Lite Agents Section -->
      <div v-if="liteAgents.length" style="margin-bottom:32px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
          <Zap :size="14" style="color:var(--accent);" />
          <span style="font-size:13px;font-weight:600;color:var(--ink);">Lite Agents</span>
          <span style="font-size:11px;color:var(--muted);margin-left:4px;">Cloud-hosted, safe tools only</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;">
          <div v-for="a in liteAgents" :key="a.id" class="nx-surface" style="padding:18px;">
            <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
              <NxAvatar :name="a.name" :color="agentColor(a)" size="lg" />
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
                  <span class="nx-h-heading">{{ a.name }}</span>
                  <span class="nx-tag" style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 7px;background:var(--accent-soft);color:var(--accent);border-radius:6px;font-weight:600;">
                    <Zap :size="9" /> Lite
                  </span>
                </div>
                <div style="font-size:12px;color:var(--muted);">{{ a.role || 'Agent' }}</div>
              </div>
              <button class="nx-switch" :class="{ on: a.isEnabled !== false }" @click="toggleAgentEnabled(a)">
                <span class="nx-switch-thumb" />
              </button>
            </div>
            <div style="font-size:13px;color:var(--ink-2);margin-bottom:14px;min-height:40px;line-height:1.5;">{{ a.description || 'No description.' }}</div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
              <div style="padding:8px 10px;background:var(--bg-sunk);border-radius:8px;">
                <div style="font-size:11px;color:var(--muted);margin-bottom:2px;">Model</div>
                <div style="font-size:13px;font-weight:500;font-family:var(--font-mono);">{{ formatModel(a.modelName || a.model || 'gpt-4o') }}</div>
              </div>
              <div style="padding:8px 10px;background:var(--bg-sunk);border-radius:8px;">
                <div style="font-size:11px;color:var(--muted);margin-bottom:2px;">Autonomy</div>
                <div style="font-size:13px;font-weight:500;">Level {{ a.defaultAutonomyLevel ?? a.autonomyLevel ?? 1 }}</div>
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
        </div>
      </div>

      <!-- Pro Agents Section -->
      <div v-if="proAgents.length" style="margin-bottom:32px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
          <Server :size="14" style="color:var(--ink);" />
          <span style="font-size:13px;font-weight:600;color:var(--ink);">Pro Agents</span>
          <span style="font-size:11px;color:var(--muted);margin-left:4px;">Runs on VPS, full system access</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;">
          <div v-for="a in proAgents" :key="a.id" class="nx-surface" style="padding:18px;">
            <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
              <NxAvatar :name="a.name" :color="agentColor(a)" size="lg" />
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
                  <span class="nx-h-heading">{{ a.name }}</span>
                  <span class="nx-tag" style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 7px;background:var(--bg-sunk);color:var(--ink);border:1px solid var(--line);border-radius:6px;font-weight:600;">
                    <Server :size="9" /> Pro
                  </span>
                </div>
                <div style="font-size:12px;color:var(--muted);">{{ a.role || 'Agent' }}</div>
              </div>
              <button class="nx-switch" :class="{ on: a.isEnabled !== false }" @click="toggleAgentEnabled(a)">
                <span class="nx-switch-thumb" />
              </button>
            </div>
            <div style="font-size:13px;color:var(--ink-2);margin-bottom:14px;min-height:40px;line-height:1.5;">{{ a.description || 'No description.' }}</div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
              <div style="padding:8px 10px;background:var(--bg-sunk);border-radius:8px;">
                <div style="font-size:11px;color:var(--muted);margin-bottom:2px;">Model</div>
                <div style="font-size:13px;font-weight:500;font-family:var(--font-mono);">{{ formatModel(a.modelName || a.model || 'gpt-4o') }}</div>
              </div>
              <div style="padding:8px 10px;background:var(--bg-sunk);border-radius:8px;">
                <div style="font-size:11px;color:var(--muted);margin-bottom:2px;">Autonomy</div>
                <div style="font-size:13px;font-weight:500;">Level {{ a.defaultAutonomyLevel ?? a.autonomyLevel ?? 1 }}</div>
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
        </div>
      </div>

      <!-- Unclassified agents (no runtimeMode set) -->
      <div v-if="unclassifiedAgents.length" style="margin-bottom:32px;">
        <div v-if="!liteAgents.length && !proAgents.length" style="margin-bottom:14px;">
          <span style="font-size:13px;font-weight:600;color:var(--ink);">All Agents</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;">
          <div v-for="a in unclassifiedAgents" :key="a.id" class="nx-surface" style="padding:18px;">
            <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;">
              <NxAvatar :name="a.name" :color="agentColor(a)" size="lg" />
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
                  <span class="nx-h-heading">{{ a.name }}</span>
                </div>
                <div style="font-size:12px;color:var(--muted);">{{ a.role || 'Agent' }}</div>
              </div>
              <button class="nx-switch" :class="{ on: a.isEnabled !== false }" @click="toggleAgentEnabled(a)">
                <span class="nx-switch-thumb" />
              </button>
            </div>
            <div style="font-size:13px;color:var(--ink-2);margin-bottom:14px;min-height:40px;line-height:1.5;">{{ a.description || 'No description.' }}</div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
              <div style="padding:8px 10px;background:var(--bg-sunk);border-radius:8px;">
                <div style="font-size:11px;color:var(--muted);margin-bottom:2px;">Model</div>
                <div style="font-size:13px;font-weight:500;font-family:var(--font-mono);">{{ formatModel(a.modelName || a.model || 'gpt-4o') }}</div>
              </div>
              <div style="padding:8px 10px;background:var(--bg-sunk);border-radius:8px;">
                <div style="font-size:11px;color:var(--muted);margin-bottom:2px;">Autonomy</div>
                <div style="font-size:13px;font-weight:500;">Level {{ a.defaultAutonomyLevel ?? a.autonomyLevel ?? 1 }}</div>
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
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!agents.length && !isLoading" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;">
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

      <!-- Create card at bottom when agents exist -->
      <div v-if="agents.length" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;margin-top:14px;">
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

        <!-- Step tabs -->
        <div style="display:flex;padding:12px 22px;gap:24px;border-bottom:1px solid var(--line);">
          <button
            v-for="(s, idx) in wizardSteps"
            :key="s"
            style="display:flex;align-items:center;gap:8px;padding:6px 0;font-weight:500;font-size:13px;"
            :style="{
              borderBottom: builderStep === idx + 1 ? '2px solid var(--accent)' : '2px solid transparent',
              color: builderStep === idx + 1 ? 'var(--ink)' : 'var(--muted)',
            }"
            @click="canNavigateToStep(idx + 1) && (builderStep = idx + 1)"
          >
            <span style="width:18px;height:18px;border-radius:50%;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;"
              :style="builderStep >= idx + 1 ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : { background: 'var(--bg-sunk)', color: 'var(--muted)' }"
            >{{ idx + 1 }}</span>
            {{ s }}
          </button>
        </div>

        <!-- Step content -->
        <div style="flex:1;overflow-y:auto;padding:22px;">

          <!-- Step 1: Identity -->
          <div v-if="builderStep === 1" style="display:flex;flex-direction:column;gap:16px;">
            <div>
              <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">Name</label>
              <input v-model="builderForm.name" class="nx-input" placeholder="e.g. Customer Care" />
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">What this agent does</label>
              <textarea v-model="builderForm.description" class="nx-input" rows="3" placeholder="Replies to customer DMs and emails in our brand voice." />
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:6px;">System prompt</label>
              <textarea v-model="builderForm.systemPrompt" class="nx-input" rows="5" placeholder="You are a helpful assistant that..." />
              <div style="font-size:11px;color:var(--muted);margin-top:6px;">Instructions that define the agent's behavior and personality.</div>
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

          <!-- Step 2: Tier Selection -->
          <div v-if="builderStep === 2" style="display:flex;flex-direction:column;gap:16px;">
            <div>
              <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:12px;">Choose agent tier</label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <!-- Lite card -->
                <button
                  style="padding:20px;text-align:left;border-radius:12px;cursor:pointer;display:flex;flex-direction:column;gap:12px;transition:border-color .12s,background .12s;"
                  :style="{
                    border: '1.5px solid ' + (builderForm.runtimeMode === 'native_saas' ? 'var(--accent)' : 'var(--line)'),
                    background: builderForm.runtimeMode === 'native_saas' ? 'var(--accent-soft)' : 'var(--bg-elev)',
                  }"
                  @click="selectTier('native_saas')"
                >
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="width:32px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;"
                      :style="builderForm.runtimeMode === 'native_saas' ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : { background: 'var(--bg-sunk)', color: 'var(--muted)' }"
                    >
                      <Zap :size="16" />
                    </span>
                    <div>
                      <div style="font-size:14px;font-weight:600;">Lite</div>
                    </div>
                  </div>
                  <div style="font-size:12px;color:var(--ink-2);line-height:1.5;">Runs in the cloud. Safe tools only. Best for simple tasks.</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;">
                    <span style="font-size:10px;padding:2px 6px;background:var(--bg-sunk);border-radius:4px;color:var(--muted);">Tasks</span>
                    <span style="font-size:10px;padding:2px 6px;background:var(--bg-sunk);border-radius:4px;color:var(--muted);">Memory</span>
                    <span style="font-size:10px;padding:2px 6px;background:var(--bg-sunk);border-radius:4px;color:var(--muted);">Search</span>
                    <span style="font-size:10px;padding:2px 6px;background:var(--bg-sunk);border-radius:4px;color:var(--muted);">Integrations</span>
                  </div>
                </button>

                <!-- Pro card -->
                <button
                  style="padding:20px;text-align:left;border-radius:12px;cursor:pointer;display:flex;flex-direction:column;gap:12px;transition:border-color .12s,background .12s;"
                  :style="{
                    border: '1.5px solid ' + (builderForm.runtimeMode === 'native_pro' ? 'var(--ink)' : 'var(--line)'),
                    background: builderForm.runtimeMode === 'native_pro' ? 'var(--bg-sunk)' : 'var(--bg-elev)',
                  }"
                  @click="selectTier('native_pro')"
                >
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="width:32px;height:32px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;"
                      :style="builderForm.runtimeMode === 'native_pro' ? { background: 'var(--ink)', color: 'var(--bg)' } : { background: 'var(--bg-sunk)', color: 'var(--muted)' }"
                    >
                      <Server :size="16" />
                    </span>
                    <div>
                      <div style="font-size:14px;font-weight:600;">Pro</div>
                    </div>
                  </div>
                  <div style="font-size:12px;color:var(--ink-2);line-height:1.5;">Runs on your dedicated server. Full system access. Best for complex automation.</div>
                  <div style="display:flex;flex-wrap:wrap;gap:4px;">
                    <span style="font-size:10px;padding:2px 6px;background:var(--bg-sunk);border-radius:4px;color:var(--muted);">Terminal</span>
                    <span style="font-size:10px;padding:2px 6px;background:var(--bg-sunk);border-radius:4px;color:var(--muted);">Filesystem</span>
                    <span style="font-size:10px;padding:2px 6px;background:var(--bg-sunk);border-radius:4px;color:var(--muted);">Code execution</span>
                    <span style="font-size:10px;padding:2px 6px;background:var(--bg-sunk);border-radius:4px;color:var(--muted);">Browser</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- Model selection -->
            <div>
              <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:8px;">Model</label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button
                  v-for="m in modelOptions"
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

            <!-- Autonomy -->
            <div>
              <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:8px;">Autonomy level</label>
              <div style="display:flex;flex-direction:column;gap:8px;">
                <button
                  v-for="lv in autonomyLevels"
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

          <!-- Step 3: Configuration -->
          <div v-if="builderStep === 3" style="display:flex;flex-direction:column;gap:16px;">
            <div>
              <label style="display:block;font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:8px;">Enabled tools</label>

              <!-- Lite tools -->
              <div v-if="builderForm.runtimeMode === 'native_saas'" style="display:flex;flex-direction:column;gap:8px;">
                <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Select the tools this agent can use. Lite agents have access to safe, cloud-based tools only.</div>
                <button
                  v-for="tool in liteTools"
                  :key="tool.id"
                  style="display:flex;gap:12px;padding:12px;border-radius:10px;text-align:left;align-items:flex-start;cursor:pointer;"
                  :style="{ border: '1px solid ' + (builderForm.enabledTools.includes(tool.id) ? 'var(--accent)' : 'var(--line)'), background: builderForm.enabledTools.includes(tool.id) ? 'var(--accent-soft)' : 'var(--bg-elev)' }"
                  @click="toggleTool(tool.id)"
                >
                  <span style="width:20px;height:20px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;"
                    :style="builderForm.enabledTools.includes(tool.id) ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : { background: 'var(--bg-sunk)', color: 'var(--muted)' }"
                  >
                    <Check v-if="builderForm.enabledTools.includes(tool.id)" :size="12" />
                  </span>
                  <div>
                    <div style="font-size:13px;font-weight:600;">{{ tool.label }}</div>
                    <div style="font-size:12px;color:var(--muted);">{{ tool.desc }}</div>
                  </div>
                </button>
              </div>

              <!-- Pro tools -->
              <div v-if="builderForm.runtimeMode === 'native_pro'" style="display:flex;flex-direction:column;gap:8px;">
                <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Select the tools this agent can use. Pro agents have full system access on your dedicated server.</div>
                <button
                  v-for="tool in proTools"
                  :key="tool.id"
                  style="display:flex;gap:12px;padding:12px;border-radius:10px;text-align:left;align-items:flex-start;cursor:pointer;"
                  :style="{ border: '1px solid ' + (builderForm.enabledTools.includes(tool.id) ? 'var(--accent)' : 'var(--line)'), background: builderForm.enabledTools.includes(tool.id) ? 'var(--accent-soft)' : 'var(--bg-elev)' }"
                  @click="toggleTool(tool.id)"
                >
                  <span style="width:20px;height:20px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;"
                    :style="builderForm.enabledTools.includes(tool.id) ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : { background: 'var(--bg-sunk)', color: 'var(--muted)' }"
                  >
                    <Check v-if="builderForm.enabledTools.includes(tool.id)" :size="12" />
                  </span>
                  <div>
                    <div style="font-size:13px;font-weight:600;">{{ tool.label }}</div>
                    <div style="font-size:12px;color:var(--muted);">{{ tool.desc }}</div>
                  </div>
                </button>
              </div>
            </div>

            <!-- Pro: model info note -->
            <div v-if="builderForm.runtimeMode === 'native_pro'" style="padding:12px 14px;background:var(--bg-sunk);border-radius:10px;border:1px solid var(--line);">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <Server v-if="builderForm.runtimeProvider === 'pro-agent'" :size="12" style="color:var(--ink);" />
                <Bot v-else :size="12" style="color:var(--ink);" />
                <span style="font-size:12px;font-weight:600;color:var(--ink);">External runtime</span>
              </div>
              <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:10px;">Choose which external runner should handle this agent by default.</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <button
                  style="padding:10px;border-radius:8px;text-align:left;cursor:pointer;"
                  :style="{ border: '1px solid ' + (builderForm.runtimeProvider === 'pro-agent' ? 'var(--accent)' : 'var(--line)'), background: builderForm.runtimeProvider === 'pro-agent' ? 'var(--accent-soft)' : 'var(--bg-elev)' }"
                  @click="builderForm.runtimeProvider = 'pro-agent'"
                >
                  <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;"><Server :size="12" /> Pro Agent</div>
                </button>
                <button
                  style="padding:10px;border-radius:8px;text-align:left;cursor:pointer;"
                  :style="{ border: '1px solid ' + (builderForm.runtimeProvider === 'hermes' ? 'var(--accent)' : 'var(--line)'), background: builderForm.runtimeProvider === 'hermes' ? 'var(--accent-soft)' : 'var(--bg-elev)' }"
                  @click="builderForm.runtimeProvider = 'hermes'"
                >
                  <div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;"><Bot :size="12" /> Hermes</div>
                </button>
              </div>
            </div>
          </div>

          <!-- Step 4: Review -->
          <div v-if="builderStep === 4" style="display:flex;flex-direction:column;gap:16px;">
            <div style="font-size:12px;font-weight:500;color:var(--ink-2);margin-bottom:4px;">Review agent configuration</div>

            <!-- Summary card -->
            <div class="nx-surface" style="padding:18px;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                <NxAvatar :name="builderForm.name || 'A'" :color="builderForm.color" size="lg" />
                <div style="flex:1;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:15px;font-weight:600;">{{ builderForm.name || 'Untitled agent' }}</span>
                    <span class="nx-tag" style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 7px;border-radius:6px;font-weight:600;"
                      :style="builderForm.runtimeMode === 'native_saas' ? { background: 'var(--accent-soft)', color: 'var(--accent)' } : { background: 'var(--bg-sunk)', color: 'var(--ink)', border: '1px solid var(--line)' }"
                    >
                      <Zap v-if="builderForm.runtimeMode === 'native_saas'" :size="9" />
                      <Server v-if="builderForm.runtimeMode === 'native_pro' && builderForm.runtimeProvider === 'pro-agent'" :size="9" />
                      <Bot v-else-if="builderForm.runtimeMode === 'native_pro'" :size="9" />
                      {{ builderForm.runtimeMode === 'native_saas' ? 'Lite' : builderForm.runtimeProvider === 'hermes' ? 'Hermes' : 'Pro' }}
                    </span>
                  </div>
                  <div style="font-size:12px;color:var(--muted);">{{ builderForm.description || 'No description' }}</div>
                </div>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                <div style="padding:8px 10px;background:var(--bg-sunk);border-radius:8px;">
                  <div style="font-size:11px;color:var(--muted);margin-bottom:2px;">Model</div>
                  <div style="font-size:13px;font-weight:500;font-family:var(--font-mono);">{{ modelOptions.find(m => m.id === builderForm.model)?.name || builderForm.model }}</div>
                </div>
                <div style="padding:8px 10px;background:var(--bg-sunk);border-radius:8px;">
                  <div style="font-size:11px;color:var(--muted);margin-bottom:2px;">Autonomy</div>
                  <div style="font-size:13px;font-weight:500;">Level {{ builderForm.autonomyLevel }}</div>
                </div>
              </div>

              <div style="margin-bottom:12px;">
                <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">Enabled tools</div>
                <div style="display:flex;flex-wrap:wrap;gap:4px;">
                  <span v-for="t in builderForm.enabledTools" :key="t" style="font-size:11px;padding:3px 8px;background:var(--accent-soft);color:var(--accent);border-radius:6px;font-weight:500;">{{ t }}</span>
                  <span v-if="!builderForm.enabledTools.length" style="font-size:12px;color:var(--muted);">None selected</span>
                </div>
              </div>

              <div v-if="builderForm.systemPrompt">
                <div style="font-size:11px;color:var(--muted);margin-bottom:6px;">System prompt</div>
                <div style="font-size:12px;color:var(--ink-2);line-height:1.5;max-height:100px;overflow:hidden;text-overflow:ellipsis;">{{ builderForm.systemPrompt }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding:16px;border-top:1px solid var(--line);display:flex;justify-content:space-between;">
          <button class="nx-btn nx-btn-ghost" @click="builderOpen = false">Cancel</button>
          <div style="display:flex;gap:8px;">
            <button v-if="builderStep > 1" class="nx-btn nx-btn-soft" @click="builderStep--">Back</button>
            <button v-if="builderStep < 4" class="nx-btn nx-btn-accent" :disabled="!canProceed" @click="builderStep++">Next <ArrowRight :size="13" /></button>
            <button v-else class="nx-btn nx-btn-accent" :disabled="saving || !builderForm.name" @click="saveAgent">
              <Check :size="13" /> {{ builderAgent ? 'Save' : 'Create agent' }}
            </button>
          </div>
        </div>
      </div>
    </template>

  </div>
</template>

<script setup lang="ts">
import { Bot, Plus, Globe, Edit, MessageSquare, X, ArrowRight, Check, Zap, Server } from 'lucide-vue-next'

definePageMeta({ middleware: 'auth' })

const { agents, isLoading, fetchAgents, createAgent, updateAgent } = useAgent()
onMounted(() => { void fetchAgents() })

const agentColorPalette = ['#C25B3F', '#7C5CC2', '#3F8FC2', '#5C9C6E', '#C29A3F', '#C23F8C']
function agentColor (a: any): string {
  if (a.metadata?.color) return a.metadata.color
  return agentColorPalette[(a.name || '').charCodeAt(0) % agentColorPalette.length]
}

function formatModel (model: string): string {
  return (model || '').replace('claude-', '')
}

const liteAgents = computed(() => agents.value.filter((a: any) => a.runtimeMode === 'native_saas'))
const proAgents = computed(() => agents.value.filter((a: any) => a.runtimeMode === 'native_pro'))
const unclassifiedAgents = computed(() => agents.value.filter((a: any) => a.runtimeMode !== 'native_saas' && a.runtimeMode !== 'native_pro'))

async function toggleAgentEnabled (agent: any) {
  agent.isEnabled = !agent.isEnabled
  try {
    await updateAgent(agent.id, { isEnabled: agent.isEnabled })
  } catch {
    agent.isEnabled = !agent.isEnabled
  }
}

const modelOptions = [
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', note: 'Recommended' },
  { id: 'claude-opus-4', name: 'Claude Opus 4', note: 'Best reasoning' },
  { id: 'claude-haiku-4', name: 'Claude Haiku 4', note: 'Fast' },
  { id: 'gpt-4o', name: 'GPT-4o', note: 'OpenAI' },
]

const autonomyLevels = [
  { level: 0, label: 'Suggest only', desc: 'Always asks before doing anything.' },
  { level: 1, label: 'Approve risky', desc: 'Spending and public posts need approval.' },
  { level: 2, label: 'Approve high-risk', desc: 'Only high spend and external sends.' },
  { level: 3, label: 'Full auto', desc: 'Acts on its own. Use with care.' },
]

const liteTools = [
  { id: 'tasks', label: 'Tasks', desc: 'Create, update, and manage tasks.' },
  { id: 'memory', label: 'Memory', desc: 'Store and recall information across sessions.' },
  { id: 'search', label: 'Search', desc: 'Search the web and workspace knowledge base.' },
  { id: 'integrations', label: 'Integrations', desc: 'Connect to external services and APIs.' },
]

const proTools = [
  { id: 'terminal', label: 'Terminal', desc: 'Execute shell commands on the server.' },
  { id: 'filesystem', label: 'Filesystem', desc: 'Read, write, and manage files.' },
  { id: 'code_execution', label: 'Code execution', desc: 'Run code in multiple languages.' },
  { id: 'browser', label: 'Browser', desc: 'Browse the web and interact with pages.' },
]

const wizardSteps = ['Identity', 'Tier', 'Tools', 'Review']

const builderOpen = ref(false)
const builderAgent = ref<any>(null)
const builderStep = ref(1)
const saving = ref(false)
const builderForm = reactive({
  name: '',
  description: '',
  systemPrompt: '',
  color: '#C25B3F',
  model: 'claude-sonnet-4',
  autonomyLevel: 1,
  runtimeMode: 'native_saas' as 'native_saas' | 'native_pro',
  runtimeProvider: 'pro-agent' as 'pro-agent' | 'hermes',
  planTier: 'economy' as 'economy' | 'pro' | 'enterprise',
  enabledTools: [] as string[],
})

function selectTier (mode: 'native_saas' | 'native_pro') {
  builderForm.runtimeMode = mode
  builderForm.runtimeProvider = 'pro-agent'
  builderForm.planTier = mode === 'native_pro' ? 'pro' : 'economy'
  builderForm.enabledTools = []
}

function toggleTool (toolId: string) {
  const idx = builderForm.enabledTools.indexOf(toolId)
  if (idx === -1) {
    builderForm.enabledTools.push(toolId)
  } else {
    builderForm.enabledTools.splice(idx, 1)
  }
}

function canNavigateToStep (step: number): boolean {
  if (step === 1) return true
  if (step === 2) return !!builderForm.name
  if (step === 3) return !!builderForm.name && !!builderForm.runtimeMode
  if (step === 4) return !!builderForm.name && !!builderForm.runtimeMode
  return false
}

const canProceed = computed(() => {
  if (builderStep.value === 1) return !!builderForm.name
  if (builderStep.value === 2) return !!builderForm.runtimeMode
  if (builderStep.value === 3) return true
  return false
})

function openBuilder (agent: any) {
  builderAgent.value = agent
  builderStep.value = 1
  if (agent) {
    Object.assign(builderForm, {
      name: agent.name || '',
      description: agent.description || '',
      systemPrompt: agent.systemPrompt || '',
      color: agent.metadata?.color || '#C25B3F',
      model: agent.modelName || agent.model || 'claude-sonnet-4',
      autonomyLevel: agent.defaultAutonomyLevel ?? agent.autonomyLevel ?? 1,
      runtimeMode: agent.runtimeMode || 'native_saas',
      runtimeProvider: agent.runtimeProvider || 'pro-agent',
      planTier: agent.planTier || 'economy',
      enabledTools: agent.enabledTools || [],
    })
  } else {
    Object.assign(builderForm, {
      name: '',
      description: '',
      systemPrompt: '',
      color: '#C25B3F',
      model: 'claude-sonnet-4',
      autonomyLevel: 1,
      runtimeMode: 'native_saas',
      runtimeProvider: 'pro-agent',
      planTier: 'economy',
      enabledTools: [],
    })
  }
  builderOpen.value = true
}

async function saveAgent () {
  saving.value = true
  try {
    const payload: Record<string, any> = {
      name: builderForm.name,
      description: builderForm.description,
      systemPrompt: builderForm.systemPrompt || `You are ${builderForm.name}. ${builderForm.description}`,
      modelProvider: 'openai',
      modelName: builderForm.model,
      defaultAutonomyLevel: builderForm.autonomyLevel,
      runtimeMode: builderForm.runtimeMode,
      runtimeProvider: builderForm.runtimeProvider,
      planTier: builderForm.planTier,
      enabledTools: builderForm.enabledTools,
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
