import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import WebSocket from 'ws';

type RuntimeJob = {
  id: string;
  workspaceId: string;
  agentProfileId: string;
  type: string;
  input: Record<string, any>;
  limits: {
    timeoutSeconds: number;
    maxOutputFiles: number;
    maxArtifactBytes: number;
    allowedExtensions: string[];
  };
  allowedAgentIds: string[];
};

type RuntimeChatCommand = {
  id: string;
  workspaceId: string;
  sessionId: string;
  type: 'start_session' | 'send_message' | 'abort_session' | 'sync_policy';
  payload: Record<string, any>;
  session: {
    id: string;
    workspaceId: string;
    agentProfileId: string;
    openclawSessionKey: string | null;
    openclawSessionId: string | null;
    status: string;
  };
  allowedAgentIds: string[];
};

type DeviceIdentity = {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
};

type RuntimeBootstrapManifest = {
  version: string;
  managedPaths: string[];
  files: Record<string, string>;
};

type BootstrapSyncState = {
  version: string | null;
  hash: string | null;
  status: 'pending' | 'synced' | 'failed';
  syncedAt?: string;
  error?: string;
};

const config = {
  backendUrl: process.env.NEXORIA_API_URL || 'http://api:3000/api/v1',
  runnerToken: process.env.NEXORIA_RUNNER_TOKEN || 'dev-runner-token-change-me',
  instanceKey: process.env.NEXORIA_RUNNER_INSTANCE_KEY || 'local-openclaw-runner',
  version: process.env.NEXORIA_RUNNER_VERSION || '0.1.0',
  openclawUrl: process.env.OPENCLAW_GATEWAY_URL || 'http://openclaw-gateway:18789',
  openclawToken: process.env.OPENCLAW_GATEWAY_TOKEN || 'dev-openclaw-token-change-me',
  openclawModel: process.env.OPENCLAW_MODEL || 'openclaw',
  workspaceDir: process.env.OPENCLAW_WORKSPACE_DIR || '/openclaw-workspace',
  configDir: process.env.OPENCLAW_CONFIG_DIR || '/openclaw-config',
  pollMs: Number(process.env.RUNNER_POLL_MS || 2500),
  heartbeatMs: Number(process.env.RUNNER_HEARTBEAT_MS || 15000),
  sseReconnectMs: Number(process.env.RUNNER_SSE_RECONNECT_MS || 3000),
  sseMaxBackoffMs: Number(process.env.RUNNER_SSE_MAX_BACKOFF_MS || 30000),
};

const riskyAgentPatterns = [
  /create\s+(a\s+)?(new\s+)?agent/i,
  /add\s+(a\s+)?(new\s+)?agent/i,
  /modify\s+(the\s+)?agents?/i,
  /openclaw\s+config\s+set/i,
  /config\s+set/i,
];

let active = false;
let chatActive = false;
let gateway: GatewayRpcClient | null = null;
let bootstrapSyncState: BootstrapSyncState = {
  version: null,
  hash: null,
  status: 'pending',
};

main().catch((err) => {
  console.error('[runner] fatal', err);
  process.exit(1);
});

async function main(): Promise<void> {
  await fs.mkdir(config.workspaceDir, { recursive: true });
  await fs.mkdir(config.configDir, { recursive: true });
  await waitForRegistration();
  await syncBootstrapManifest();
  await heartbeat();
  setInterval(() => void heartbeat(), config.heartbeatMs);
  connectRunnerEvents();
  console.log(`[runner] ready instanceKey=${config.instanceKey} backend=${config.backendUrl} openclaw=${config.openclawUrl}`);
}

async function waitForRegistration(): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await register();
      return;
    } catch (err: any) {
      const delayMs = Math.min(30000, 1000 * attempt);
      console.warn(`[runner] backend registration failed: ${err.message}. Retrying in ${delayMs}ms.`);
      await sleep(delayMs);
    }
  }
}

async function register(): Promise<void> {
  await backend('/runner/runtime/instances', {
    method: 'POST',
    body: {
      instanceKey: config.instanceKey,
      mode: 'local-docker',
      version: config.version,
      gatewayUrl: config.openclawUrl,
      metadata: {
        workspaceDir: config.workspaceDir,
        configDir: config.configDir,
        bootstrap: bootstrapSyncState,
      },
    },
  });
}

async function heartbeat(): Promise<void> {
  const ready = await openclawReady();
  await backend(`/runner/runtime/instances/${encodeURIComponent(config.instanceKey)}/heartbeat`, {
    method: 'POST',
    body: {
      status: ready ? 'ready' : 'error',
      metadata: {
        openclawReady: ready,
        checkedAt: new Date().toISOString(),
        bootstrap: bootstrapSyncState,
      },
    },
  }).catch((err) => console.warn('[runner] heartbeat failed', err.message));
}

async function syncBootstrapManifest(): Promise<void> {
  try {
    const manifest = await backend<RuntimeBootstrapManifest>('/runner/runtime/bootstrap/manifest');
    validateBootstrapManifest(manifest);
    const hash = hashBootstrapManifest(manifest);
    const markerPath = path.join(config.workspaceDir, '.nexoria-bootstrap.json');
    const previous = await readBootstrapMarker(markerPath);
    const needsSync = previous?.version !== manifest.version
      || previous?.hash !== hash
      || await hasBootstrapFileDrift(manifest);

    if (!needsSync) {
      bootstrapSyncState = {
        version: manifest.version,
        hash,
        status: 'synced',
        syncedAt: previous?.syncedAt || new Date().toISOString(),
      };
      console.log(`[runner] bootstrap already synced version=${manifest.version} hash=${hash}`);
      return;
    }

    for (const managedPath of manifest.managedPaths) {
      const content = manifest.files[managedPath];
      if (typeof content !== 'string') throw new Error(`Bootstrap manifest missing content for ${managedPath}`);
      const target = safeWorkspaceFile(managedPath);
      await fs.writeFile(target, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
    }

    const syncedAt = new Date().toISOString();
    await fs.writeFile(markerPath, `${JSON.stringify({
      source: 'nexoria',
      version: manifest.version,
      hash,
      managedPaths: manifest.managedPaths,
      syncedAt,
    }, null, 2)}\n`, 'utf8');

    bootstrapSyncState = {
      version: manifest.version,
      hash,
      status: 'synced',
      syncedAt,
    };
    console.log(`[runner] bootstrap synced version=${manifest.version} hash=${hash} files=${manifest.managedPaths.length}`);
  } catch (err: any) {
    bootstrapSyncState = {
      version: null,
      hash: null,
      status: 'failed',
      error: err?.message || 'Bootstrap sync failed.',
    };
    console.warn('[runner] bootstrap sync failed', bootstrapSyncState.error);
  }
}

function validateBootstrapManifest(manifest: RuntimeBootstrapManifest): void {
  if (!manifest || typeof manifest.version !== 'string' || !manifest.version) {
    throw new Error('Bootstrap manifest is missing version.');
  }
  if (!Array.isArray(manifest.managedPaths) || manifest.managedPaths.length === 0) {
    throw new Error('Bootstrap manifest is missing managedPaths.');
  }
  if (!manifest.files || typeof manifest.files !== 'object') {
    throw new Error('Bootstrap manifest is missing files.');
  }
  for (const managedPath of manifest.managedPaths) {
    safeWorkspaceFile(managedPath);
    if (typeof manifest.files[managedPath] !== 'string') {
      throw new Error(`Bootstrap manifest has invalid file content for ${managedPath}.`);
    }
  }
}

function hashBootstrapManifest(manifest: RuntimeBootstrapManifest): string {
  const normalized = {
    version: manifest.version,
    managedPaths: [...manifest.managedPaths].sort(),
    files: Object.fromEntries(Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b))),
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

async function readBootstrapMarker(markerPath: string): Promise<{ version?: string; hash?: string; syncedAt?: string } | null> {
  try {
    return JSON.parse(await fs.readFile(markerPath, 'utf8'));
  } catch {
    return null;
  }
}

async function hasBootstrapFileDrift(manifest: RuntimeBootstrapManifest): Promise<boolean> {
  for (const managedPath of manifest.managedPaths) {
    const target = safeWorkspaceFile(managedPath);
    const expected = manifest.files[managedPath].endsWith('\n') ? manifest.files[managedPath] : `${manifest.files[managedPath]}\n`;
    const actual = await fs.readFile(target, 'utf8').catch(() => null);
    if (actual !== expected) return true;
  }
  return false;
}

function safeWorkspaceFile(managedPath: string): string {
  if (!managedPath || managedPath.includes('/') || managedPath.includes('\\') || managedPath === '.' || managedPath === '..') {
    throw new Error(`Unsafe bootstrap managed path: ${managedPath}`);
  }
  const resolvedWorkspace = path.resolve(config.workspaceDir);
  const resolvedTarget = path.resolve(resolvedWorkspace, managedPath);
  if (!resolvedTarget.startsWith(`${resolvedWorkspace}${path.sep}`)) {
    throw new Error(`Bootstrap managed path escapes workspace: ${managedPath}`);
  }
  return resolvedTarget;
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function poll(): Promise<void> {
  if (active) return;
  active = true;
  try {
    const job = await backend<RuntimeJob | null>(`/runner/runtime/instances/${encodeURIComponent(config.instanceKey)}/jobs/next`);
    if (job) await runJob(job);
  } catch (err: any) {
    console.warn('[runner] poll failed', err.message);
  } finally {
    active = false;
  }
}

async function pollChatCommands(): Promise<void> {
  if (chatActive) return;
  chatActive = true;
  try {
    const command = await backend<RuntimeChatCommand | null>(`/runner/runtime/instances/${encodeURIComponent(config.instanceKey)}/chat/commands/next`);
    if (command) await runChatCommand(command);
  } catch (err: any) {
    console.warn('[runner] chat poll failed', err.message);
  } finally {
    chatActive = false;
  }
}

/* SSE-based runner event stream (replaces naive polling when available) */
let sseBackoffMs = config.sseReconnectMs;
let sseFallbackTimer: NodeJS.Timeout | null = null;
let sseAbort: AbortController | null = null;

function connectRunnerEvents(): void {
  const url = `${config.backendUrl}/runner/runtime/instances/${encodeURIComponent(config.instanceKey)}/events`;
  sseAbort = new AbortController();
  const headers: Record<string, string> = {
    accept: 'text/event-stream',
    'x-runner-token': config.runnerToken,
  };

  fetch(url, { headers, signal: sseAbort.signal })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        throw new Error(`SSE endpoint returned ${res.status}`);
      }
      console.log('[runner] sse connected');
      sseBackoffMs = config.sseReconnectMs;
      if (sseFallbackTimer) {
        clearInterval(sseFallbackTimer);
        sseFallbackTimer = null;
      }
      const reader = res.body.getReader();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += new TextDecoder().decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const event = JSON.parse(trimmed.slice(6));
              if (event.type === 'job') {
                void runJob(event.data as RuntimeJob);
              } else if (event.type === 'chat_command') {
                void runChatCommand(event.data as RuntimeChatCommand);
              }
            } catch (err: any) {
              console.warn('[runner] sse message parse failed', err.message);
            }
          }
        }
      }
      throw new Error('SSE stream closed');
    })
    .catch((err: any) => {
      if (err.name === 'AbortError') return;
      const delay = Math.min(sseBackoffMs, config.sseMaxBackoffMs);
      sseBackoffMs = Math.min(sseBackoffMs * 2, config.sseMaxBackoffMs);
      console.warn(`[runner] sse disconnected (${err.message}); reconnecting in ${delay}ms`);
      setTimeout(() => connectRunnerEvents(), delay);

      if (!sseFallbackTimer) {
        sseFallbackTimer = setInterval(() => {
          void poll();
          void pollChatCommands();
        }, config.pollMs);
      }
    });
}

async function runChatCommand(command: RuntimeChatCommand): Promise<void> {
  if (!command.allowedAgentIds.includes(command.session.agentProfileId)) {
    await chatEvent(command, 'error', `Agent ${command.session.agentProfileId} is not in the backend allowlist.`);
    await completeChatCommand(command, 'failed', undefined, `Agent ${command.session.agentProfileId} is not in the backend allowlist.`);
    return;
  }

  const content = String(command.payload?.content || '');
  if (content && riskyAgentPatterns.some((pattern) => pattern.test(content))) {
    const message = 'Creating or modifying OpenClaw agents is not allowed in managed runtime v1.';
    await chatEvent(command, 'error', message);
    await completeChatCommand(command, 'failed', { policyViolation: true }, message);
    return;
  }

  const ready = await openclawReady();
  if (!ready) {
    await chatEvent(command, 'error', 'OpenClaw gateway is not ready.');
    await completeChatCommand(command, 'failed', undefined, 'OpenClaw gateway is not ready.');
    return;
  }

  try {
    if (command.type === 'start_session') {
      const session = await ensureOpenClawChatSession(command);
      await completeChatCommand(command, 'completed', session);
      await chatEvent(command, 'status', 'OpenClaw chat session is ready.', { openclawSessionKey: session.openclawSessionKey });
      return;
    }

    if (command.type === 'send_message') {
      await materializeChatAttachments(command);
      let session = command.session.openclawSessionKey
        ? {
            openclawSessionKey: command.session.openclawSessionKey,
            openclawSessionId: command.session.openclawSessionId,
          }
        : await ensureOpenClawChatSession(command);
      try {
        await sendOpenClawChatMessage(command, session.openclawSessionKey, session.openclawSessionId);
      } catch (err: any) {
        if (command.session.openclawSessionKey && isStaleSessionError(err)) {
          console.warn(`[runner] cached OpenClaw session is stale (${err.message}); recreating.`);
          await chatEvent(command, 'status', 'OpenClaw session was reset; starting a fresh session.');
          session = await ensureOpenClawChatSession(command);
          await sendOpenClawChatMessage(command, session.openclawSessionKey, session.openclawSessionId, { withRecoveryContext: true });
        } else {
          throw err;
        }
      }
      await completeChatCommand(command, 'completed', { openclawSessionKey: session.openclawSessionKey, openclawSessionId: session.openclawSessionId });
      return;
    }

    if (command.type === 'sync_policy') {
      await completeChatCommand(command, 'completed', { syncedAt: new Date().toISOString() });
      return;
    }

    await completeChatCommand(command, 'cancelled', undefined, `Unsupported chat command ${command.type}.`);
  } catch (err: any) {
    await chatEvent(command, 'error', err.message || 'OpenClaw chat command failed.');
    await completeChatCommand(command, 'failed', undefined, err.message || 'OpenClaw chat command failed.');
  }
}

async function ensureOpenClawChatSession(_command: RuntimeChatCommand): Promise<{ openclawSessionKey: string; openclawSessionId: string | null; metadata?: Record<string, any> }> {
  const client = await gatewayClient();
  const response = await client.request<any>('sessions.create', {});
  const openclawSessionKey = String(response.key || response.sessionKey || '');
  if (!openclawSessionKey) throw new Error('OpenClaw sessions.create did not return a session key.');
  return {
    openclawSessionKey,
    openclawSessionId: response.sessionId ? String(response.sessionId) : null,
    metadata: {
      transport: 'gateway-ws',
      openclawRunStarted: Boolean(response.runStarted),
    },
  };
}

async function sendOpenClawChatMessage(
  command: RuntimeChatCommand,
  sessionKey: string,
  sessionId: string | null,
  opts: { withRecoveryContext?: boolean } = {},
): Promise<void> {
  const client = await gatewayClient();
  const runId = crypto.randomUUID();
  const baseMessage = buildManagedChatMessage(command);
  const message = opts.withRecoveryContext
    ? [
        '[Nexoria runtime context]',
        `Active agent: ${command.session.agentProfileId}`,
        `Allowed agents: ${command.allowedAgentIds.join(', ')}`,
        'Note: your previous OpenClaw session was reset; continue from the user message below.',
        '[/Nexoria runtime context]',
        '',
        baseMessage,
      ].join('\n')
    : baseMessage;
  await chatEvent(command, 'status', 'OpenClaw is thinking.', { runId });
  const finalPromise = client.waitForChatFinal(sessionKey, runId, 300000);
  await client.request<any>('chat.send', {
    sessionKey,
    ...(sessionId ? { sessionId } : {}),
    message,
    deliver: false,
    idempotencyKey: runId,
  });
  const final = await finalPromise;
  const text = extractGatewayMessageText(final.message) || 'OpenClaw completed without a text response.';
  await chatEvent(command, 'assistant_final', text, { runId, raw: final.message });
}

function isStaleSessionError(err: any): boolean {
  const msg = String(err?.message ?? err ?? '').toLowerCase();
  return (
    /agent\s+\S+\s+(no longer exists|not found|does not exist)/i.test(msg) ||
    /session\s+\S+\s+(not found|expired|closed|unknown)/i.test(msg) ||
    /unknown\s+session/i.test(msg) ||
    /invalid\s+session/i.test(msg) ||
    /no longer exists in configuration/i.test(msg)
  );
}

function buildManagedChatMessage(command: RuntimeChatCommand): string {
  const content = String(command.payload?.content || '');
  const context = command.payload?.context;
  const localAttachments = Array.isArray(command.payload?.localAttachments) ? command.payload.localAttachments : [];
  const attachmentText = localAttachments.length
    ? [
        'Approved input attachments copied into the OpenClaw workspace:',
        ...localAttachments.map((attachment: any) => `- ${attachment.filename} (${attachment.mimeType}, attachmentId=${attachment.id}) at ${attachment.localPath}`),
        'Use these local paths only during this session. Durable file references are Nexoria attachment ids.',
      ].join('\n')
    : '';
  if (!context) return [attachmentText, content].filter(Boolean).join('\n\n');
  const instructions = Array.isArray(context.instructions) ? context.instructions.join('\n') : '';
  return [
    '[Nexoria managed runtime context]',
    instructions,
    `Allowed agents: ${(context.allowedAgentIds || command.allowedAgentIds).join(', ')}`,
    `Active agent: ${command.session.agentProfileId}`,
    attachmentText,
    '[/Nexoria managed runtime context]',
    '',
    content,
  ].filter(Boolean).join('\n');
}

async function materializeChatAttachments(command: RuntimeChatCommand): Promise<void> {
  const attachments = Array.isArray(command.payload?.attachments) ? command.payload.attachments : [];
  if (attachments.length === 0) return;
  const targetDir = path.join(config.workspaceDir, 'nexoria-inputs', safeSegment(command.sessionId), safeSegment(command.id));
  await fs.mkdir(targetDir, { recursive: true });
  const localAttachments: any[] = [];
  for (const attachment of attachments.slice(0, 10)) {
    const url = String(attachment.downloadUrl || '');
    if (!url) continue;
    const filename = path.basename(String(attachment.filename || attachment.id || 'attachment.bin')).replace(/[^a-zA-Z0-9._-]/g, '_');
    const localPath = path.join(targetDir, filename);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download attachment ${attachment.id}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(localPath, bytes);
    localAttachments.push({
      id: attachment.id,
      filename,
      mimeType: attachment.mimeType,
      sizeBytes: bytes.length,
      localPath,
    });
  }
  command.payload.localAttachments = localAttachments;
}

async function runJob(job: RuntimeJob): Promise<void> {
  const startedAt = Date.now();
  await event(job, 'job_started', 'info', `Running OpenClaw job with agent ${job.agentProfileId}.`);

  if (!job.allowedAgentIds.includes(job.agentProfileId)) {
    await rejectPolicy(job, `Agent ${job.agentProfileId} is not in the backend allowlist.`);
    return;
  }

  const prompt = String(job.input?.prompt || job.input?.message || job.input?.instructions || '');
  if (riskyAgentPatterns.some((pattern) => pattern.test(prompt))) {
    await rejectPolicy(job, 'Creating or modifying OpenClaw agents is not allowed in managed runtime v1.');
    return;
  }

  const ready = await openclawReady();
  if (!ready) {
    await event(job, 'openclaw_unhealthy', 'error', 'OpenClaw gateway is not ready.');
    await complete(job, 'failed', undefined, 'OpenClaw gateway is not ready.');
    return;
  }

  const before = await listWorkspaceFiles();
  try {
    const output = await withTimeout(callOpenClaw(job, prompt), job.limits.timeoutSeconds * 1000);
    const resultPath = await writeResultArtifact(job, output);
    const after = await listWorkspaceFiles();
    const changed = [...new Set([...after.filter((file) => !before.includes(file)), resultPath])];
    const uploaded = await uploadChangedFiles(job, changed);
    await complete(job, 'completed', {
      output,
      artifacts: uploaded,
      durationMs: Date.now() - startedAt,
    });
  } catch (err: any) {
    await event(job, 'job_failed', 'error', err.message || 'Runtime job failed.');
    await complete(job, 'failed', undefined, err.message || 'Runtime job failed.');
  }
}

async function callOpenClaw(job: RuntimeJob, prompt: string): Promise<string> {
  const delegatedAgentName = String(job.input?.delegatedAgentName || job.input?.metadata?.delegatedAgentName || '').trim();
  const normalizedDelegatedAgentName = delegatedAgentName.toLowerCase();
  const isSocialMediaAgent = normalizedDelegatedAgentName === 'social media agent' || normalizedDelegatedAgentName === 'content creator';
  const system = [
    'You are running inside a managed Nexoria OpenClaw runtime.',
    `Active Nexoria workspaceId: ${job.workspaceId}.`,
    `Use only this approved agent id: ${job.agentProfileId}.`,
    'When calling Nexoria MCP tools, pass the exact active workspaceId above. Never invent or substitute a workspace id.',
    'Do not create, modify, install, or switch to other agents.',
    ...(isSocialMediaAgent
      ? [
          'You are the delegated Nexoria Social Media Agent.',
          'For social/Facebook post draft work, write the copy and media brief, then call the Nexoria MCP create_social_post_draft tool with createReviewTask=true.',
          'When creating a social post draft, include metadata.source="social_media_agent_runtime" and metadata.createdByAgentRole="social_media_agent".',
          'Do not only return draft copy in chat; the durable Nexoria draft and approval are required.',
        ]
      : []),
    'Place any useful generated files in the current workspace directory.',
    'If a user asks to create or modify agents, refuse and explain that an admin approval is required.',
  ].join('\n');

  const res = await fetch(`${config.openclawUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: openclawHeaders(),
    body: JSON.stringify({
      model: config.openclawModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt || JSON.stringify(job.input) },
      ],
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenClaw gateway request failed (${res.status}): ${text.slice(0, 500)}`);
  }
  try {
    const json = JSON.parse(text);
    return json.choices?.[0]?.message?.content || json.output_text || json.response || text;
  } catch {
    return text;
  }
}

async function rejectPolicy(job: RuntimeJob, message: string): Promise<void> {
  await event(job, 'policy_violation', 'warn', message);
  await complete(job, 'rejected', { policyViolation: true }, message);
}

async function openclawReady(): Promise<boolean> {
  try {
    const res = await fetch(`${config.openclawUrl}/readyz`, { headers: openclawHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}

async function writeResultArtifact(job: RuntimeJob, output: string): Promise<string> {
  const dir = path.join(config.workspaceDir, 'nexoria-results', job.id);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, 'openclaw-result.md');
  await fs.writeFile(file, [
    `# OpenClaw Result`,
    '',
    `Job: ${job.id}`,
    `Agent: ${job.agentProfileId}`,
    '',
    output,
  ].join('\n'));
  return file;
}

async function uploadChangedFiles(job: RuntimeJob, files: string[]): Promise<any[]> {
  const uploaded: any[] = [];
  for (const file of files.slice(0, job.limits.maxOutputFiles)) {
    const normalized = path.resolve(file);
    if (!normalized.startsWith(path.resolve(config.workspaceDir))) continue;
    const stat = await fs.stat(normalized).catch(() => null);
    if (!stat?.isFile()) continue;
    if (stat.size > job.limits.maxArtifactBytes) continue;
    const extension = path.extname(normalized).toLowerCase();
    if (!job.limits.allowedExtensions.includes(extension)) continue;
    const contentBase64 = await fs.readFile(normalized, 'base64');
    const artifact = await backend(`/runner/runtime/instances/${encodeURIComponent(config.instanceKey)}/jobs/${job.id}/artifacts`, {
      method: 'POST',
      body: {
        filename: path.basename(normalized),
        mimeType: mimeTypeFor(extension),
        contentBase64,
        metadata: {
          relativePath: path.relative(config.workspaceDir, normalized),
        },
      },
    });
    uploaded.push(artifact);
  }
  return uploaded;
}

async function listWorkspaceFiles(): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        await walk(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  }
  await walk(config.workspaceDir);
  return files;
}

async function backend<T = any>(endpoint: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${config.backendUrl}${endpoint}`, {
    method: opts.method || 'GET',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'x-runner-token': config.runnerToken,
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Backend request failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

async function event(job: RuntimeJob, type: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata: Record<string, any> = {}): Promise<void> {
  await backend(`/runner/runtime/instances/${encodeURIComponent(config.instanceKey)}/jobs/${job.id}/events`, {
    method: 'POST',
    body: { type, level, message, metadata },
  }).catch((err) => console.warn('[runner] event failed', err.message));
}

async function complete(job: RuntimeJob, status: 'completed' | 'failed' | 'rejected' | 'cancelled', result?: Record<string, any>, error?: string): Promise<void> {
  await backend(`/runner/runtime/instances/${encodeURIComponent(config.instanceKey)}/jobs/${job.id}/result`, {
    method: 'POST',
    body: { status, result, error },
  });
}

async function completeChatCommand(command: RuntimeChatCommand, status: 'completed' | 'failed' | 'cancelled', result?: Record<string, any>, error?: string): Promise<void> {
  await backend(`/runner/runtime/instances/${encodeURIComponent(config.instanceKey)}/chat/commands/${command.id}/result`, {
    method: 'POST',
    body: { status, result, error },
  });
}

async function chatEvent(command: RuntimeChatCommand, type: string, content?: string, metadata: Record<string, any> = {}): Promise<void> {
  await backend(`/runner/runtime/instances/${encodeURIComponent(config.instanceKey)}/chat/sessions/${command.sessionId}/events`, {
    method: 'POST',
    body: {
      type,
      content,
      status: metadata.status,
      runId: metadata.runId,
      metadata,
    },
  }).catch((err) => console.warn('[runner] chat event failed', err.message));
}

async function gatewayClient(): Promise<GatewayRpcClient> {
  if (!gateway) {
    gateway = new GatewayRpcClient({
      url: toWebSocketUrl(config.openclawUrl),
      token: config.openclawToken,
      onEvent: (event) => {
        if (event.event !== 'tick') {
          console.debug?.('[runner] gateway event', event.event);
        }
      },
    });
  }
  await gateway.connect();
  return gateway;
}

function toWebSocketUrl(input: string): string {
  const trimmed = input.replace(/\/$/, '');
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) return trimmed;
  if (trimmed.startsWith('https://')) return `wss://${trimmed.slice('https://'.length)}`;
  if (trimmed.startsWith('http://')) return `ws://${trimmed.slice('http://'.length)}`;
  return `ws://${trimmed}`;
}

function loadOrCreateDeviceIdentity(): DeviceIdentity {
  const filePath = path.join(config.configDir, 'nexoria-runner-device.json');
  try {
    if (fsSync.existsSync(filePath)) {
      const parsed = JSON.parse(fsSync.readFileSync(filePath, 'utf8'));
      if (parsed?.version === 1 && typeof parsed.deviceId === 'string' && typeof parsed.publicKeyPem === 'string' && typeof parsed.privateKeyPem === 'string') {
        return {
          deviceId: parsed.deviceId,
          publicKeyPem: parsed.publicKeyPem,
          privateKeyPem: parsed.privateKeyPem,
        };
      }
    }
  } catch {
    // Regenerate below if the persisted identity cannot be read.
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const deviceId = crypto.createHash('sha256').update(derivePublicKeyRaw(publicKeyPem)).digest('hex');
  fsSync.mkdirSync(path.dirname(filePath), { recursive: true });
  fsSync.writeFileSync(filePath, `${JSON.stringify({ version: 1, deviceId, publicKeyPem, privateKeyPem, createdAtMs: Date.now() }, null, 2)}\n`, { mode: 0o600 });
  return { deviceId, publicKeyPem, privateKeyPem };
}

function buildDeviceAuthPayload(params: { identity: DeviceIdentity; clientId: string; clientMode: string; role: string; scopes: string[]; signedAtMs: number; token: string; nonce: string; platform: string }): string {
  return [
    'v3',
    params.identity.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(','),
    String(params.signedAtMs),
    params.token,
    params.nonce,
    params.platform,
    '',
  ].join('|');
}

function signDevicePayload(privateKeyPem: string, payload: string): string {
  return base64UrlEncode(crypto.sign(null, Buffer.from(payload, 'utf8'), crypto.createPrivateKey(privateKeyPem)));
}

function publicKeyRawBase64UrlFromPem(publicKeyPem: string): string {
  return base64UrlEncode(derivePublicKeyRaw(publicKeyPem));
}

function derivePublicKeyRaw(publicKeyPem: string): Buffer {
  const prefix = Buffer.from('302a300506032b6570032100', 'hex');
  const spki = crypto.createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' });
  return spki.length === prefix.length + 32 && spki.subarray(0, prefix.length).equals(prefix)
    ? spki.subarray(prefix.length)
    : spki;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function extractGatewayMessageText(message: any): string {
  if (!message) return '';
  if (typeof message.text === 'string') return message.text;
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part: any) => typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : '')
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
}

function openclawHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    accept: 'application/json',
    authorization: `Bearer ${config.openclawToken}`,
  };
}

type GatewayEventFrame = {
  type: 'event';
  event: string;
  seq?: number;
  payload?: any;
};

type GatewayResponseFrame = {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: any;
  error?: { message?: string; code?: string; details?: any };
};

class GatewayRpcClient {
  private ws: WebSocket | null = null;
  private connecting: Promise<void> | null = null;
  private pending = new Map<string, { resolve: (value: any) => void; reject: (err: Error) => void; timeout: NodeJS.Timeout | null }>();
  private chatWaiters = new Map<string, { sessionKey: string; runId: string; resolve: (value: any) => void; reject: (err: Error) => void; timeout: NodeJS.Timeout }>();

  constructor(private readonly opts: { url: string; token: string; onEvent?: (event: GatewayEventFrame) => void }) {}

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.open();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  async request<T = any>(method: string, params: Record<string, any>, timeoutMs = 30000): Promise<T> {
    await this.connect();
    return this.rawRequest<T>(method, params, timeoutMs);
  }

  private async rawRequest<T = any>(method: string, params: Record<string, any>, timeoutMs = 30000): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('OpenClaw gateway websocket is not connected.');
    const id = crypto.randomUUID();
    const frame = { type: 'req', id, method, params };
    const promise = new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`OpenClaw gateway request timeout for ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
    });
    this.ws.send(JSON.stringify(frame));
    return promise;
  }

  waitForChatFinal(sessionKey: string, runId: string, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.chatWaiters.delete(runId);
        reject(new Error('OpenClaw chat response timed out.'));
      }, timeoutMs);
      this.chatWaiters.set(runId, { sessionKey, runId, resolve, reject, timeout });
    });
  }

  private open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.opts.url, { maxPayload: 25 * 1024 * 1024 });
      this.ws = ws;
      let connected = false;
      const startupTimer = setTimeout(() => {
        if (!connected) {
          ws.close();
          reject(new Error('OpenClaw gateway websocket connect timeout.'));
        }
      }, 15000);

      ws.on('message', (data) => {
        const raw = data.toString();
        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return;
        }
        if (parsed?.type === 'event') {
          this.handleEvent(parsed);
          if (parsed.event === 'connect.challenge') {
            const nonce = String(parsed.payload?.nonce || '');
            this.sendConnect(nonce)
              .then(() => {
                connected = true;
                clearTimeout(startupTimer);
                resolve();
              })
              .catch((err) => {
                clearTimeout(startupTimer);
                reject(err);
              });
          }
          return;
        }
        if (parsed?.type === 'res') this.handleResponse(parsed);
      });

      ws.on('error', (err) => {
        if (!connected) {
          clearTimeout(startupTimer);
          reject(err);
        }
      });

      ws.on('close', () => {
        if (!connected) {
          clearTimeout(startupTimer);
          reject(new Error('OpenClaw gateway websocket closed during connect.'));
        }
        this.ws = null;
        for (const [, pending] of this.pending) {
          if (pending.timeout) clearTimeout(pending.timeout);
          pending.reject(new Error('OpenClaw gateway websocket closed.'));
        }
        this.pending.clear();
        for (const [, waiter] of this.chatWaiters) {
          clearTimeout(waiter.timeout);
          waiter.reject(new Error('OpenClaw gateway websocket closed.'));
        }
        this.chatWaiters.clear();
      });
    });
  }

  private sendConnect(nonce: string): Promise<any> {
    const scopes = ['operator.read', 'operator.write'];
    const clientId = 'gateway-client';
    const clientMode = 'backend';
    const role = 'operator';
    const signedAtMs = Date.now();
    const identity = loadOrCreateDeviceIdentity();
    const payload = buildDeviceAuthPayload({
      identity,
      clientId,
      clientMode,
      role,
      scopes,
      signedAtMs,
      token: this.opts.token,
      nonce,
      platform: process.platform,
    });
    return this.rawRequest('connect', {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: clientId,
        displayName: 'Nexoria Runner',
        version: config.version,
        platform: process.platform,
        mode: clientMode,
        instanceId: config.instanceKey,
      },
      caps: [],
      auth: { token: this.opts.token },
      role,
      scopes,
      device: {
        id: identity.deviceId,
        publicKey: publicKeyRawBase64UrlFromPem(identity.publicKeyPem),
        signature: signDevicePayload(identity.privateKeyPem, payload),
        signedAt: signedAtMs,
        nonce,
      },
    });
  }

  private handleEvent(event: GatewayEventFrame): void {
    this.opts.onEvent?.(event);
    if (event.event !== 'chat') return;
    const payload = event.payload ?? {};
    const runId = String(payload.runId || '');
    const waiter = this.chatWaiters.get(runId);
    if (!waiter || payload.sessionKey !== waiter.sessionKey) return;
    if (payload.state === 'final') {
      clearTimeout(waiter.timeout);
      this.chatWaiters.delete(runId);
      waiter.resolve(payload);
    } else if (payload.state === 'error' || payload.state === 'aborted') {
      clearTimeout(waiter.timeout);
      this.chatWaiters.delete(runId);
      waiter.reject(new Error(payload.errorMessage || `OpenClaw chat ${payload.state}.`));
    }
  }

  private handleResponse(response: GatewayResponseFrame): void {
    const pending = this.pending.get(response.id);
    if (!pending) return;
    this.pending.delete(response.id);
    if (pending.timeout) clearTimeout(pending.timeout);
    if (response.ok) {
      pending.resolve(response.payload);
    } else {
      pending.reject(new Error(response.error?.message || 'OpenClaw gateway request failed.'));
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mimeTypeFor(extension: string): string {
  switch (extension) {
    case '.csv': return 'text/csv';
    case '.json': return 'application/json';
    case '.html': return 'text/html';
    case '.md': return 'text/markdown';
    default: return 'text/plain';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Runtime job timed out')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
