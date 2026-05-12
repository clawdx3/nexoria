import { Injectable, Logger } from '@nestjs/common';
import {
  AgentContext,
  AgentExecutorResult,
  AgentStep,
  AgentTool,
  ToolContext,
} from '../../../shared/interfaces/agent.interfaces';
import { LlmProviderFactory } from '../llm-provider/llm-provider.factory';
import { ToolRegistryService } from '../tool-registry/tool-registry.service';
import { MemoryContextBuilder } from '../memory-context/memory-context.builder';
import { ReflectionService } from '../reflection/reflection.service';
import { MemoryOutcomeTrackerService } from '../../memory/memory-outcome-tracker.service';
import {
  AgentLoop as AgentLoopCore,
  AgentToolRegistry,
  CompositeMemoryManager,
  IterativeSummarizer,
  tokenEstimate,
  AskUserInterrupt,
  SessionFileStateStore,
  StreamingChunk,
  DefaultCompactionEngine,
} from '@nexoria/agent-core';

@Injectable()
export class AgentExecutorService {
  private readonly logger = new Logger(AgentExecutorService.name);
  private readonly MAX_STEPS = 10;

  constructor(
    private readonly llmFactory: LlmProviderFactory,
    private readonly toolRegistry: ToolRegistryService,
    private readonly memoryBuilder: MemoryContextBuilder,
    private readonly reflection: ReflectionService,
    private readonly outcomeTracker: MemoryOutcomeTrackerService,
  ) {}

  async run(
    ctx: AgentContext,
    userMessage: string,
    onChunk?: (chunk: StreamingChunk) => void,
    existingMessages?: Array<{ role: string; content: string }>,
  ): Promise<AgentExecutorResult> {
    const start = Date.now();
    const registry = new AgentToolRegistry();
    const available = this.toolRegistry.listForContext(ctx as ToolContext);
    for (const tool of available) {
      registry.register(tool);
    }

    const stateStore = ctx.sessionId ? new SessionFileStateStore() : undefined;
    const toolCtx: ToolContext = {
      ...ctx,
      stateStore,
    };

    let recalledMemoryIds: string[] = [];

    const memoryProvider = {
      loadTier: async (_ctx: any, tier: string, limit: number) => {
        const result = await this.memoryBuilder.build(toolCtx, userMessage);
        recalledMemoryIds = result.recalledIds;
        if (tier === 'profile') return result.profile.slice(0, limit);
        if (tier === 'session') return result.session.slice(0, limit);
        if (tier === 'daily') return result.daily.slice(0, limit);
        if (tier === 'long_term') return result.longTerm.slice(0, limit);
        return [];
      },
      loadLongTerm: async (_ctx: any, query: string, limit: number) => {
        const result = await this.memoryBuilder.build(toolCtx, query);
        recalledMemoryIds = [...new Set([...recalledMemoryIds, ...result.recalledIds])];
        return result.longTerm.slice(0, limit);
      },
      store: async (_ctx: any, _content: string, _tier: string, _type: string) => {},
    };
    const memoryManager = new CompositeMemoryManager(memoryProvider);

    const core = new AgentLoopCore();
    const contextEngine = new DefaultCompactionEngine();

    try {
      const coreResult = await core.run(
        {
          profile: ctx.agentProfile as any,
          llm: async (params) => {
            const res = await this.llmFactory.generate(ctx, params.system, params.messages);
            return { text: res.text, usage: { totalTokens: res.tokens } };
          },
          toolRegistry: registry,
          memoryManager,
          context: toolCtx as any,
          maxSteps: this.MAX_STEPS,
          maxTokens: (ctx.agentProfile.modelConfig as any)?.maxTokens ?? 2048,
          temperature: (ctx.agentProfile.modelConfig as any)?.temperature ?? 0.7,
          emit: onChunk,
          enableConcurrency: true,
          enableCompaction: true,
          contextEngine,
        },
        userMessage,
        { existingMessages },
      );

      const result: AgentExecutorResult = {
        success: coreResult.success,
        steps: coreResult.steps,
        finalOutput: coreResult.finalOutput,
        tokensUsed: coreResult.tokensUsed,
        durationMs: Date.now() - start,
      };

      await this.reflection.reflect(ctx, result);
      this.outcomeTracker.recordOutcome(recalledMemoryIds, result.success).catch(() => {});
      return result;
    } catch (err: any) {
      if (err instanceof AskUserInterrupt || (err as any)?._tag === 'AskUserInterrupt') {
        const result: AgentExecutorResult = {
          success: false,
          steps: [],
          finalOutput: null,
          error: err.message,
          tokensUsed: 0,
          durationMs: Date.now() - start,
          interruptedByApprovalId: err.approvalId,
        };
        return result;
      }
      this.logger.error(`AgentExecutorService failed: ${err.message}`);
      const result: AgentExecutorResult = {
        success: false,
        steps: [],
        finalOutput: null,
        error: err.message || 'Unknown error',
        tokensUsed: 0,
        durationMs: Date.now() - start,
      };
      await this.reflection.reflect(ctx, result);
      this.outcomeTracker.recordOutcome(recalledMemoryIds, false).catch(() => {});
      return result;
    }
  }
}
