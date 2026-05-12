import { AgentLoop as AgentLoopCore, AgentToolRegistry, CompositeMemoryManager, AgentProfile, ToolContext, MemoryProvider } from '@nexoria/agent-core';
import { Config } from './config';
import { NexoriaMemoryProvider } from './memory';

export class ProAgentLoop {
  private readonly loop = new AgentLoopCore();
  readonly registry = new AgentToolRegistry();
  private readonly memoryManager: CompositeMemoryManager;

  constructor(
    private readonly config: Config,
    private readonly llm: any,
    memoryProvider?: MemoryProvider,
  ) {
    const provider = memoryProvider ?? new NexoriaMemoryProvider(
      config.nexoriaApiUrl,
      config.agentToken,
      config.workspaceId,
    );
    this.memoryManager = new CompositeMemoryManager(provider);
  }

  registerTool(tool: any): void {
    this.registry.register(tool);
  }

  async run(
    profile: any,
    userMessage: string,
    opts?: {
      existingMessages?: Array<{ role: string; content: string }>;
      userId?: string;
      sessionId?: string;
    },
    emit?: (chunk: any) => void,
  ): Promise<{ success: boolean; finalOutput: string | null; error?: string }> {
    const ctx: ToolContext = {
      agentProfile: profile,
      workspaceId: this.config.workspaceId,
      triggeredByUserId: opts?.userId ?? 'pro-agent',
      userRole: 'system',
      autonomyLevel: 3,
      sessionId: opts?.sessionId,
    };

    const result = await this.loop.run(
      {
        profile,
        llm: async (params) => {
          const res = await this.llm(params.system, params.messages, {
            maxTokens: params.maxTokens ?? 2048,
            temperature: params.temperature ?? 0.7,
          });
          return { text: res.text };
        },
        toolRegistry: this.registry,
        memoryManager: this.memoryManager,
        context: ctx,
        maxSteps: 10,
        maxTokens: (profile.modelConfig as any)?.maxTokens ?? 2048,
        temperature: (profile.modelConfig as any)?.temperature ?? 0.7,
        emit,
      },
      userMessage,
      { existingMessages: opts?.existingMessages },
    );

    return {
      success: result.success,
      finalOutput: result.finalOutput,
      error: result.error,
    };
  }
}
