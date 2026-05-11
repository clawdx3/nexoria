// Subagent Worker Process
// Real LLM-powered subagent that runs as a forked child process

import { LLMRouter, LLMMessage, LLMTool } from '../llm/router';
import { ToolRegistry } from '../tools/registry';
import { AgentConfig, RoleConfig } from '../config/types';
import { createProvider } from '../llm/providers';

interface SubagentInit {
  type: 'init';
  role: string;
  taskId: string;
  context: any;
  payload: any;
  config: AgentConfig;
}

interface SubagentTask {
  type: 'run';
  instructions: string;
}

const role = process.env.SUBAGENT_ROLE || 'orchestrator';
const taskId = process.env.SUBAGENT_TASK_ID || 'unknown';
const subagentId = process.env.SUBAGENT_ID || 'unknown';

console.log(`[subagent ${subagentId}] started role=${role} task=${taskId}`);

// Runtime state
let agentConfig: AgentConfig | null = null;
let roleConfig: RoleConfig | null = null;
let llm: LLMRouter | null = null;
let tools: ToolRegistry | null = null;
let currentTask: any = null;

process.on('message', async (msg: SubagentInit | SubagentTask) => {
  if (msg.type === 'init') {
    try {
      await initializeSubagent(msg);
      process.send?.({ type: 'progress', data: { status: 'ready', subagentId } });
    } catch (err: any) {
      console.error(`[subagent ${subagentId}] init error:`, err);
      process.send?.({ type: 'error', data: { error: err.message, subagentId } });
      process.exit(1);
    }
    return;
  }

  if (msg.type === 'run') {
    try {
      const result = await executeSubagentWork(role, msg.instructions, currentTask?.context);
      process.send?.({ type: 'done', data: { result, subagentId } });
      process.exit(0);
    } catch (err: any) {
      console.error(`[subagent ${subagentId}] error:`, err);
      process.send?.({ type: 'error', data: { error: err.message, subagentId } });
      process.exit(1);
    }
  }
});

async function initializeSubagent(msg: SubagentInit): Promise<void> {
  currentTask = msg;
  agentConfig = msg.config;

  // Resolve role config
  roleConfig = agentConfig.roles[msg.role] || {
    id: msg.role,
    name: msg.role,
    description: 'Specialist subagent',
    systemPrompt: `You are a specialist agent named "${msg.role}". Execute the given instructions carefully and return a structured result.`,
    enabledTools: [],
    model: agentConfig.models.default,
    maxConcurrency: 1,
  };

  // Setup LLM
  llm = new LLMRouter();
  for (const provider of agentConfig.models.providers) {
    try {
      const p = createProvider(provider);
      if (p) llm.registerProvider(p);
    } catch (err: any) {
      console.warn(`[subagent ${subagentId}] failed to register provider ${provider.id}:`, err.message);
    }
  }

  // Setup tools
  tools = new ToolRegistry();
  const toolIds = roleConfig.enabledTools.length ? roleConfig.enabledTools : agentConfig.tools.enabled;
  for (const toolId of toolIds) {
    try {
      await tools.load(toolId);
    } catch (err: any) {
      console.warn(`[subagent ${subagentId}] failed to load tool ${toolId}:`, err.message);
    }
  }

  console.log(`[subagent ${subagentId}] initialized with ${toolIds.length} tools, model=${roleConfig.model}`);
}

async function executeSubagentWork(
  roleName: string,
  instructions: string,
  context: any,
): Promise<any> {
  if (!llm || !tools || !agentConfig) {
    throw new Error('Subagent not initialized');
  }

  console.log(`[subagent ${subagentId}] executing: ${instructions.slice(0, 120)}...`);

  const systemPrompt = roleConfig?.systemPrompt || `You are ${roleName}. Execute instructions and return results.`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Context: ${JSON.stringify(context || {})}\n\nInstructions: ${instructions}` },
  ];

  const maxSteps = 10;
  let step = 0;

  while (step < maxSteps) {
    step++;

    // Progress update
    process.send?.({
      type: 'progress',
      data: { status: 'working', step: `step_${step}`, progress: step / maxSteps },
    });

    // Get available tools in LLM format
    const availableTools = tools.list().map((t) => t.toLLMFormat());

    // Call LLM
    const response = await llm.send({
      model: roleConfig?.model || agentConfig.models.default,
      messages,
      tools: availableTools.length ? availableTools : undefined,
      temperature: 0.7,
      maxTokens: 4096,
    });

    // If no tool calls, we're done
    if (!response.toolCalls || response.toolCalls.length === 0) {
      return {
        output: response.content,
        role: roleName,
        subagentId,
        steps: step,
        model: response.model,
        usage: response.usage,
      };
    }

    // Execute tool calls
    const toolResults: LLMMessage[] = [];
    for (const tc of response.toolCalls) {
      try {
        const args = JSON.parse(tc.function.arguments);
        const result = await tools.execute(tc.function.name, args);

        toolResults.push({
          role: 'tool',
          content: JSON.stringify(result),
          name: tc.function.name,
        });

        console.log(`[subagent ${subagentId}] tool ${tc.function.name} executed`);
      } catch (err: any) {
        toolResults.push({
          role: 'tool',
          content: JSON.stringify({ error: err.message }),
          name: tc.function.name,
        });

        console.error(`[subagent ${subagentId}] tool ${tc.function.name} failed:`, err.message);
      }
    }

    // Add assistant message + tool results to conversation
    messages.push({
      role: 'assistant',
      content: response.content || '',
    });
    for (const tr of toolResults) {
      messages.push(tr);
    }
  }

  // Max steps reached - return last LLM output
  return {
    output: 'Maximum steps reached',
    role: roleName,
    subagentId,
    steps: step,
    truncated: true,
  };
}

// Handle parent disconnect
process.on('disconnect', () => {
  console.log(`[subagent ${subagentId}] parent disconnected, exiting`);
  process.exit(0);
});

// Keep alive until work is done or parent kills us
setInterval(() => {}, 1000);
