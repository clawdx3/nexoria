import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { AgentConfig, RoleConfig } from '../config/types';
import { LLMRouter, LLMRequest, LLMMessage, LLMToolCall } from '../llm/router';
import { HubClient, TaskOffer, ApprovalRequest } from '../hub/client';
import { ToolRegistry } from '../tools/registry';
import { SkillRegistry } from '../skills/registry';
import { MemoryStore } from '../memory/store';
import { SubagentManager } from '../subagents/manager';

export interface AgentContext {
  taskId: string;
  userId: string;
  workspaceId: string;
  conversationHistory: LLMMessage[];
  metadata: Record<string, any>;
}

export class AgentRuntime extends EventEmitter {
  private config: AgentConfig | null = null;
  private hub: HubClient;
  private llm: LLMRouter;
  private tools: ToolRegistry;
  private skills: SkillRegistry;
  private memory: MemoryStore;
  private subagents: SubagentManager;
  private runningTasks = new Map<string, AbortController>();
  private isShuttingDown = false;

  constructor(hub: HubClient, llm: LLMRouter, tools: ToolRegistry, skills: SkillRegistry, memory: MemoryStore) {
    super();
    this.hub = hub;
    this.llm = llm;
    this.tools = tools;
    this.skills = skills;
    this.memory = memory;
    this.subagents = new SubagentManager();

    // Hub event handlers
    this.hub.on('config_update', this.onConfigUpdate.bind(this));
    this.hub.on('task_offer', this.onTaskOffer.bind(this));
    this.hub.on('approval_response', this.onApprovalResponse.bind(this));
    this.hub.on('registered', () => this.emit('ready'));
  }

  async boot(config: AgentConfig): Promise<void> {
    this.config = config;
    
    // Setup LLM providers from config
    for (const provider of config.models.providers) {
      const { createProvider } = await import('../llm/providers');
      const p = createProvider(provider);
      if (p) this.llm.registerProvider(p);
    }

    // Setup tools
    for (const toolId of config.tools.enabled) {
      await this.tools.load(toolId);
    }

    // Setup skills
    for (const skillId of config.skills.enabled) {
      await this.skills.load(skillId);
    }

    // Connect to hub
    await this.hub.connect();
    
    console.log(`[runtime] booted agent=${config.agentId} user=${config.userId}`);
    this.emit('booted', config);
  }

  private async onConfigUpdate(update: { version: string; patch?: Partial<AgentConfig>; full?: AgentConfig }): Promise<void> {
    if (update.full) {
      this.config = update.full;
    } else if (update.patch) {
      this.config = { ...this.config!, ...update.patch };
    }
    
    this.hub.sendConfigAck(update.version);
    console.log(`[runtime] config updated to ${update.version}`);
    this.emit('config_updated', this.config);
  }

  private async onTaskOffer(offer: TaskOffer): Promise<void> {
    if (this.runningTasks.size >= (this.config?.limits.maxSubagents || 4)) {
      this.hub.rejectTask(offer.taskId, 'at_capacity');
      return;
    }

    this.hub.acceptTask(offer.taskId);
    
    const abortController = new AbortController();
    this.runningTasks.set(offer.taskId, abortController);

    try {
      await this.executeTask(offer, abortController.signal);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        this.hub.sendError(offer.taskId, 'Task was cancelled');
      } else {
        console.error(`[runtime] task ${offer.taskId} failed:`, err);
        this.hub.sendError(offer.taskId, err.message);
      }
    } finally {
      this.runningTasks.delete(offer.taskId);
    }
  }

  private async executeTask(offer: TaskOffer, signal: AbortSignal): Promise<void> {
    console.log(`[runtime] executing task ${offer.taskId}: ${offer.type}`);

    const context: AgentContext = {
      taskId: offer.taskId,
      userId: this.config!.userId,
      workspaceId: this.config!.workspaceId,
      conversationHistory: [],
      metadata: offer.payload,
    };

    // Stream progress
    this.hub.sendProgress(offer.taskId, { status: 'running', step: 'analyzing' });

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt();

    // Determine if we need a subagent
    const role = this.determineRole(offer.type, offer.payload);
    
    if (role && role !== 'orchestrator') {
      // Delegate to subagent
      this.hub.sendProgress(offer.taskId, { status: 'running', step: `spawning_${role}` });
      
      const subagentResult = await this.subagents.spawn({
        role,
        taskId: offer.taskId,
        context,
        signal,
        onProgress: (data) => {
          this.hub.sendSubagentProgress(data.subagentId, offer.taskId, data);
        },
      });

      this.hub.sendResult(offer.taskId, {
        status: 'completed',
        role,
        output: subagentResult,
      });
      return;
    }

    // Orchestrator handles directly
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(offer.payload) },
    ];

    // Check if this requires approval
    const riskLevel = this.assessRisk(offer.type, offer.payload);
    if (riskLevel >= 3) { // high or critical
      const approval = await this.requestApproval(offer.taskId, offer.type, offer.payload, riskLevel);
      if (!approval.approved) {
        this.hub.sendResult(offer.taskId, { status: 'rejected', reason: 'User rejected approval' });
        return;
      }
    }

    this.hub.sendProgress(offer.taskId, { status: 'running', step: 'executing' });

    // Convert tools to LLM format
    const tools = this.tools.list().map((t) => t.toLLMFormat());

    const response = await this.llm.send({
      model: this.config!.models.default,
      messages,
      tools: tools.length ? tools : undefined,
    });

    // Handle tool calls
    if (response.toolCalls?.length) {
      for (const toolCall of response.toolCalls) {
        this.hub.sendProgress(offer.taskId, { status: 'running', step: `tool_${toolCall.function.name}` });
        
        const result = await this.tools.execute(toolCall.function.name, JSON.parse(toolCall.function.arguments));
        messages.push({
          role: 'assistant',
          content: '',
        });
        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          name: toolCall.function.name,
        });
      }

      // Get final response with tool results
      const finalResponse = await this.llm.send({
        model: this.config!.models.default,
        messages,
        tools: tools.length ? tools : undefined,
      });

      response.content = finalResponse.content;
    }

    // Persist to memory
    await this.memory.add(context.workspaceId, {
      taskId: offer.taskId,
      role: 'orchestrator',
      content: response.content,
      timestamp: new Date(),
    });

    this.hub.sendResult(offer.taskId, {
      status: 'completed',
      output: response.content,
      usage: response.usage,
    });
  }

  private buildSystemPrompt(): string {
    if (!this.config) return '';
    
    return [
      `You are ${this.config.personality.name}.`,
      this.config.personality.systemPrompt,
      `Tone: ${this.config.personality.tone}`,
      `Autonomy level: ${this.config.personality.autonomyLevel}/5`,
      `Workspace: ${this.config.workspaceId}`,
      '',
      'Available tools:',
      ...this.tools.list().map((t) => `- ${t.name}: ${t.description}`),
      '',
      'When using tools, always pass the correct workspaceId.',
      'For risky operations, request user approval before proceeding.',
    ].join('\n');
  }

  private determineRole(taskType: string, payload: Record<string, any>): string | null {
    // Simple routing rules
    const typeMap: Record<string, string> = {
      'research': 'researcher',
      'content_draft': 'content_creator',
      'social_post': 'content_creator',
      'email_campaign': 'content_creator',
      'code_review': 'code_reviewer',
      'code_generate': 'developer',
      'browser_task': 'researcher',
    };

    // Check payload for explicit role
    if (payload.role && this.config?.roles[payload.role]) {
      return payload.role;
    }

    // Check task type
    if (typeMap[taskType]) {
      return typeMap[taskType];
    }

    // Default: orchestrator handles it
    return null;
  }

  private assessRisk(taskType: string, payload: Record<string, any>): number {
    const riskMatrix: Record<string, number> = {
      'delete': 5,
      'remove': 4,
      'deploy': 4,
      'publish': 3,
      'send_email': 3,
      'send_message': 3,
      'create': 1,
      'draft': 1,
      'research': 1,
      'analyze': 1,
    };

    // Check task type
    if (riskMatrix[taskType] !== undefined) {
      return riskMatrix[taskType];
    }

    // Check payload for dangerous keywords
    const payloadStr = JSON.stringify(payload).toLowerCase();
    if (payloadStr.includes('delete all') || payloadStr.includes('drop table')) return 5;
    if (payloadStr.includes('delete') || payloadStr.includes('remove')) return 3;
    if (payloadStr.includes('publish') || payloadStr.includes('send')) return 2;

    return 1; // low risk by default
  }

  private async requestApproval(
    taskId: string,
    taskType: string,
    payload: Record<string, any>,
    riskLevel: number
  ): Promise<{ approved: boolean; decision?: string }> {
    const approvalId = uuidv4();
    
    const approval: ApprovalRequest = {
      approvalId,
      type: taskType,
      title: `Approve ${taskType}`,
      description: `The agent wants to perform: ${JSON.stringify(payload)}`,
      requestedAction: taskType,
      riskLevel: riskLevel >= 4 ? 'critical' : riskLevel >= 3 ? 'high' : 'medium',
    };

    this.hub.requestApproval(approval);
    this.hub.sendProgress(taskId, { status: 'awaiting_approval', approvalId });

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ approved: false, decision: 'timeout' });
      }, 300000); // 5 minute timeout

      this.hub.once('approval_response', (response: { approvalId: string; approved: boolean; decision?: string }) => {
        if (response.approvalId === approvalId) {
          clearTimeout(timeout);
          resolve({ approved: response.approved, decision: response.decision });
        }
      });
    });
  }

  private onApprovalResponse(response: { approvalId: string; approved: boolean }): void {
    // Handled in the promise above
    this.emit('approval_response', response);
  }

  cancelTask(taskId: string): void {
    const controller = this.runningTasks.get(taskId);
    if (controller) {
      controller.abort();
      this.runningTasks.delete(taskId);
      console.log(`[runtime] cancelled task ${taskId}`);
    }
  }

  getStatus(): Record<string, any> {
    return {
      configVersion: this.config?.version || null,
      runningTasks: Array.from(this.runningTasks.keys()),
      subagents: this.subagents.list(),
      models: this.llm.listModels(),
      tools: this.tools.list().map((t) => t.name),
      skills: this.skills.list(),
    };
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    // Cancel all running tasks
    for (const [taskId, controller] of this.runningTasks) {
      controller.abort();
    }
    this.runningTasks.clear();

    // Shutdown subagents
    await this.subagents.shutdown();

    // Disconnect from hub
    this.hub.shutdown();

    console.log('[runtime] shutdown complete');
    this.emit('shutdown');
  }
}
