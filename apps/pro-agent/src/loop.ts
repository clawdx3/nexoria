import { AgentLoop as AgentLoopCore, AgentToolRegistry, CompositeMemoryManager, AgentProfile, ToolContext } from '@nexoria/agent-core';
import { Config } from './config';

export class ProAgentLoop {
  private readonly loop = new AgentLoopCore();
  private readonly registry = new AgentToolRegistry();

  constructor(
    private readonly config: Config,
    private readonly llm: any,
  ) {}

  registerTool(tool: any): void {
    this.registry.register(tool);
  }

  async run(
    profile: any,
    userMessage: string,
    existingMessages?: Array<{ role: string; content: string }>,
    emit?: (chunk: any) => void,
  ): Promise<{ success: boolean; finalOutput: string | null; error?: string }> {
    const ctx: ToolContext = {
      agentProfile: profile,
      workspaceId: this.config.workspaceId,
      triggeredByUserId: 'pro-agent',
      userRole: 'system',
      autonomyLevel: 3,
    };

    const memoryProvider = {
      loadTier: async (_ctx: any, _tier: string, _limit: number) => [],
      loadLongTerm: async (_ctx: any, _query: string, _limit: number) => [],
      store: async (_ctx: any, _content: string, _tier: string, _type: string) => {},
    };
    const memoryManager = new CompositeMemoryManager(memoryProvider);

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
        memoryManager,
        context: ctx,
        maxSteps: 10,
        maxTokens: (profile.modelConfig as any)?.maxTokens ?? 2048,
        temperature: (profile.modelConfig as any)?.temperature ?? 0.7,
        emit,
      },
      userMessage,
      { existingMessages },
    );

    return {
      success: result.success,
      finalOutput: result.finalOutput,
      error: result.error,
    };
  }
}
