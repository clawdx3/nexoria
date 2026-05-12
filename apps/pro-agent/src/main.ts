import { Config } from './config';
import { WsProAgentApiClient } from './api-client';
import { ProAgentLoop } from './loop';
import { resolveLlmAdapter } from './llm';
import { registerDangerousTools, registerDelegationTool, registerMemoryTools } from './tools';
import { SubagentSpawner } from './subagents';
import { loadOrCreateKeys, signMessage, getPublicKeyBase64 } from './keys/keys';
import { NexoriaMemoryProvider } from './memory';
import * as http from 'node:http';
import * as nacl from 'tweetnacl';

const config = new Config();
const missing = config.validate();
if (missing.length > 0) {
  console.error('Missing config fields:', missing.join(', '));
  process.exit(1);
}

const instanceKey = `pro-agent-${config.workspaceId}`;
const api = new WsProAgentApiClient(config);
const llm = resolveLlmAdapter({
  id: config.workspaceId,
  name: 'Pro Agent',
  systemPrompt: '',
  modelProvider: config.llmProvider as any,
  modelName: config.llmModel,
  modelConfig: { apiKey: config.llmApiKey },
  enabledTools: [],
  role: 'specialist' as const,
  runtimeMode: 'native_pro' as const,
  defaultAutonomyLevel: 3,
});

const memoryProvider = new NexoriaMemoryProvider(config.nexoriaApiUrl, config.agentToken, config.workspaceId);
const agent = new ProAgentLoop(config, llm, memoryProvider);
registerDangerousTools(agent, config);
registerMemoryTools(agent, config);

const spawner = new SubagentSpawner(llm, agent.registry, memoryProvider);
registerDelegationTool(agent, config, spawner, api);

// Ensure Ed25519 keys exist
loadOrCreateKeys(config.localDir);

// Lightweight health server so Docker healthcheck passes
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', instanceKey }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});
healthServer.listen(3002, () => {
  console.log('Health server listening on port 3002');
});

async function main() {
  // 1. Register instance via HTTP (with Ed25519 signed payload)
  let retries = 0;
  const maxRetries = 12;
  while (retries < maxRetries) {
    try {
      await api.registerInstance(instanceKey, {
        ed25519PublicKey: getPublicKeyBase64(config.localDir),
      });
      console.log('Registered instance:', instanceKey);
      break;
    } catch (err: any) {
      retries++;
      const wait = Math.min(1000 * 2 ** retries, 15000);
      console.error(`API not ready (${retries}/${maxRetries}): ${err.message}. Retrying in ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  if (retries >= maxRetries) {
    console.error('Max retries reached. API is unreachable.');
    process.exit(1);
  }

  // 2. Connect WebSocket and authenticate with Ed25519 challenge-response
  api.onAuthChallenge((payload: { nonce: string }) => {
    const { privateKey } = loadOrCreateKeys(config.localDir);
    const signature = signMessage(privateKey, payload.nonce);
    api.emitAuthResponse(instanceKey, signature);
  });

  await api.connect();
  console.log('WebSocket connected');

  // 3. Heartbeat via HTTP every 15s
  setInterval(async () => {
    try {
      await api.heartbeat(instanceKey, 'ready');
    } catch (err: any) {
      console.error('Heartbeat failed:', err.message);
    }
  }, 15000);

  // 4. Listen for pushed jobs from API
  api.onJobPushed(async (job) => {
    console.log('Job pushed via WS:', job.id, job.type);
    await runJob(job);
  });

  // 5. Claim loop (falls back if WS push missed)
  while (true) {
    try {
      const job = await api.claimNextJob(instanceKey);
      if (!job) {
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }
      console.log('Claimed job:', job.id, job.type);
      await runJob(job);
    } catch (err: any) {
      console.error('Job loop error:', err.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function runJob(job: any) {
  const input = job.input ?? {};

  const registeredTools = agent.registry.listAll();
  const enabledToolNames = registeredTools.map((t) => t.name);

  // Build a proper system prompt that includes memory instructions
  const systemPrompt = [
    'You are a powerful AI assistant running in a dedicated container with full filesystem, shell, and code execution capabilities.',
    'You have persistent memory via `search_memory` (recall) and `nudge_memory` (store).',
    'Always use `search_memory` before answering questions about the user or workspace history.',
    'After learning something important about the user, use `nudge_memory` to persist it for future conversations.',
    'When multiple tools are needed, you can call them in parallel by outputting multiple JSON blocks.',
  ].join(' ');

  const profile: any = {
    id: config.workspaceId,
    name: 'Pro Agent',
    systemPrompt,
    modelProvider: config.llmProvider as any,
    modelName: config.llmModel,
    modelConfig: { apiKey: config.llmApiKey },
    enabledTools: enabledToolNames,
    role: 'specialist',
    runtimeMode: 'native_pro',
    defaultAutonomyLevel: 3,
  };

  const result = await agent.run(profile, input.content || '', {
    existingMessages: input.recentMessages,
    userId: input.userId,
    sessionId: input.chatSessionId,
  }, (chunk) => {
    if (job.type === 'native_pro_chat' && input.chatSessionId) {
      if (chunk.type === 'token') {
        api.emitChatChunk(input.chatSessionId, job.id, chunk.content || '');
      }
    }
    api.postEvent(instanceKey, job.id, {
      type: chunk.type,
      level: 'info',
      message: chunk.content || chunk.toolName || '',
      metadata: { toolArgs: chunk.toolArgs, result: chunk.result },
    });
  });

  if (job.type === 'native_pro_chat' && input.chatSessionId && result.success) {
    api.emitChatFinal(input.chatSessionId, job.id, result.finalOutput || '');
  }

  await api.completeJob(instanceKey, job.id, {
    status: result.success ? 'completed' : 'failed',
    result: result.success ? { output: result.finalOutput } : undefined,
    error: result.error || undefined,
  });
  console.log('Completed job:', job.id, result.success ? 'success' : 'failed');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
