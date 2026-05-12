import { Injectable, Logger } from '@nestjs/common';
import {
  AgentLoop as AgentLoopCore,
  AgentToolRegistry,
  CompositeMemoryManager,
  StreamingChunk,
} from '@nexoria/agent-core';
import { AgentContext } from '../../../shared/interfaces/agent.interfaces';
import { MemoryContextBuilder } from '../memory-context/memory-context.builder';
import { ToolRegistryService } from '../tool-registry/tool-registry.service';
import { LlmProviderFactory } from '../llm-provider/llm-provider.factory';

@Injectable()
export class AgentLoopService {
  private readonly logger = new Logger(AgentLoopService.name);
  private readonly agentLoop = new AgentLoopCore();

  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly memoryBuilder: MemoryContextBuilder,
    private readonly llmProvider: LlmProviderFactory,
  ) {}

  async run(
    ctx: AgentContext,
    userMessage: string,
    emit?: (event: any) => void,
    existingMessages?: Array<{ role: string; content: string }>,
  ): Promise<{ success: boolean; finalOutput: string | null; error?: string; interruptedByApprovalId?: string }> {
    try {
      const registry = new AgentToolRegistry();
      const available = this.toolRegistry.listForContext(ctx).filter((t) => t.riskLevel <= 2);
      for (const tool of available) {
        registry.register(tool);
      }

      const memory = await this.memoryBuilder.build(ctx, userMessage);
      const provider = {
        loadTier: async (_ctx: any, tier: string, limit: number) => {
          const result = await this.memoryBuilder.build(ctx);
          if (tier === 'profile') return result.profile.slice(0, limit);
          if (tier === 'session') return result.session.slice(0, limit);
          if (tier === 'daily') return result.daily.slice(0, limit);
          if (tier === 'long_term') return result.longTerm.slice(0, limit);
          return [];
        },
        loadLongTerm: async (_ctx: any, query: string, limit: number) => {
          const result = await this.memoryBuilder.build(ctx, query);
          return result.longTerm.slice(0, limit);
        },
        store: async (_ctx: any, _content: string, _tier: string, _type: string) => {},
      };
      const memoryManager = new CompositeMemoryManager(provider);

      const result = await this.agentLoop.run(
        {
          profile: ctx.agentProfile as any,
          llm: async (params) => {
            const res = await this.llmProvider.generate(ctx, params.system, params.messages);
            return { text: res.text };
          },
          toolRegistry: registry,
          memoryManager,
          context: ctx as any,
          maxSteps: 10,
          maxTokens: (ctx.agentProfile.modelConfig as any)?.maxTokens ?? 2048,
          temperature: (ctx.agentProfile.modelConfig as any)?.temperature ?? 0.7,
          emit,
          enableConcurrency: true,
          enableCompaction: true,
        },
        userMessage,
        existingMessages ? { existingMessages } : undefined,
      );

      return {
        success: result.success,
        finalOutput: result.finalOutput,
        error: result.error,
        interruptedByApprovalId: (result as any).interruptedByApprovalId,
      };
    } catch (err: any) {
      this.logger.error(`AgentLoopService failed: ${err.message}`);
      return { success: false, finalOutput: null, error: err.message };
    }
  }
}
