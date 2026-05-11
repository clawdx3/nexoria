import { AgentConfig } from './config/types';
import { HubClient } from './hub/client';
import { LLMRouter } from './llm/router';
import { ToolRegistry } from './tools/registry';
import { SkillRegistry } from './skills/registry';
import { MemoryStore } from './memory/store';
import { AgentRuntime } from './core/runtime';

const config: AgentConfig = {
  version: '0.1.0',
  userId: process.env.NEXORIA_USER_ID || 'unknown',
  workspaceId: process.env.NEXORIA_WORKSPACE_ID || 'unknown',
  agentId: process.env.NEXORIA_AGENT_ID || 'power-agent-1',
  
  personality: {
    name: 'Nexoria Power Agent',
    systemPrompt: 'You are a powerful AI assistant running on a dedicated server. You can use shell commands, browse the web, write files, and create content. Always be helpful and careful with destructive operations.',
    tone: 'professional',
    autonomyLevel: 3,
  },
  
  roles: {
    researcher: {
      id: 'researcher',
      name: 'Researcher',
      description: 'Research topics on the web',
      systemPrompt: 'You are a research specialist. Find accurate information and present it clearly.',
      enabledTools: ['web_search', 'shell'],
      model: 'default',
      maxConcurrency: 2,
    },
    content_creator: {
      id: 'content_creator',
      name: 'Content Creator',
      description: 'Create social media posts, blogs, and emails',
      systemPrompt: 'You are a content creation specialist. Write engaging, on-brand content.',
      enabledTools: ['file_write', 'nexoria_api'],
      model: 'default',
      maxConcurrency: 2,
    },
    code_reviewer: {
      id: 'code_reviewer',
      name: 'Code Reviewer',
      description: 'Review and analyze code',
      systemPrompt: 'You are a code review specialist. Identify bugs, suggest improvements, and ensure best practices.',
      enabledTools: ['file_read', 'shell'],
      model: 'default',
      maxConcurrency: 1,
    },
  },
  
  models: {
    default: 'ollama/kimi-k2.6:cloud',
    fast: 'ollama/kimi-k2.6:cloud',
    providers: [
      {
        id: 'ollama',
        type: 'ollama',
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        apiKey: process.env.OLLAMA_API_KEY || '',
        models: ['kimi-k2.6:cloud', 'kimi-k2.6:cloud'],
      },
      {
        id: 'openrouter',
        type: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        models: ['openai/gpt-4o', 'anthropic/claude-3-5-sonnet'],
      },
      {
        id: 'openai',
        type: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY || '',
        models: ['gpt-4o', 'gpt-4o-mini'],
      },
    ],
  },
  
  memory: {
    compactionThreshold: 1000,
    maxContextTokens: 8000,
    localStorePath: process.env.NEXORIA_DATA_DIR || '/var/nexoria/data',
  },
  
  tools: {
    enabled: ['shell', 'file_read', 'file_write', 'web_search', 'nexoria_api'],
    custom: [],
  },
  
  skills: {
    enabled: ['crypto-researcher', 'social-media-manager', 'content-creator'],
    registry: 'https://skills.nexoria.io/v1',
  },
  
  limits: {
    maxSubagents: 4,
    timeoutSeconds: 300,
    maxOutputFiles: 10,
  },
};

async function main() {
  console.log('[power-agent] starting...');
  
  // Initialize components
  const hub = new HubClient({
    hubUrl: process.env.NEXORIA_HUB_URL || 'wss://nexoria.io/agent-hub/v1',
    token: process.env.NEXORIA_RUNNER_TOKEN || 'dev-token',
    instanceKey: process.env.NEXORIA_INSTANCE_KEY || 'power-agent-local',
    reconnectMs: 3000,
    maxReconnectMs: 30000,
    heartbeatMs: 30000,
  });

  const llm = new LLMRouter();
  const tools = new ToolRegistry();
  const skills = new SkillRegistry();
  const memory = new MemoryStore();

  // Initialize memory store
  await memory.init();

  // Create and boot runtime
  const runtime = new AgentRuntime(hub, llm, tools, skills, memory);

  runtime.on('ready', () => {
    console.log('[power-agent] ready and connected to hub');
  });

  runtime.on('config_updated', () => {
    console.log('[power-agent] config updated');
  });

  runtime.on('shutdown', () => {
    console.log('[power-agent] shutdown complete');
    process.exit(0);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[power-agent] SIGTERM received, shutting down...');
    runtime.shutdown();
  });

  process.on('SIGINT', () => {
    console.log('[power-agent] SIGINT received, shutting down...');
    runtime.shutdown();
  });

  // Boot
  await runtime.boot(config);

  // Keep alive
  process.stdin.resume();
}

main().catch((err) => {
  console.error('[power-agent] fatal error:', err);
  process.exit(1);
});
