import { Injectable } from '@nestjs/common';
import { MemoryAdapter, MemoryContextRequest, MemoryContextResult, MemoryStoreRequest, MemorySearchRequest, MemorySearchResult } from './memory-adapter.interface';
import { MemoryContextBuilder } from '../memory-context/memory-context.builder';
import { MemoryService } from '../../memory/memory.service';

@Injectable()
export class DbMemoryAdapter implements MemoryAdapter {
  constructor(
    private readonly builder: MemoryContextBuilder,
    private readonly memoryService: MemoryService,
  ) {}

  async loadContext(ctx: MemoryContextRequest): Promise<MemoryContextResult> {
    const agentCtx = {
      workspaceId: ctx.workspaceId,
      triggeredByUserId: ctx.userId,
      userRole: 'user',
      autonomyLevel: 1,
      sessionId: ctx.sessionId,
      agentProfile: { id: ctx.agentProfileId, name: '', systemPrompt: '', modelProvider: 'openai', modelName: 'gpt-4o', enabledTools: [], role: 'specialist' },
    };
    const memory = await this.builder.build(agentCtx, ctx.query);
    return {
      text: this.builder.formatForPrompt(memory),
      entries: [],
    };
  }

  async store(entry: MemoryStoreRequest): Promise<void> {
    await this.memoryService.create(entry.workspaceId, {
      userId: entry.userId,
      content: entry.content,
      tier: entry.tier as any,
      type: entry.type as any,
      sessionId: entry.sessionId,
      confidence: entry.confidence,
      metadata: entry.metadata,
    });
  }

  async search(query: MemorySearchRequest): Promise<MemorySearchResult[]> {
    const results = await this.memoryService.searchByText(query.workspaceId, query.query, query.limit ?? 10);
    return results.map((r) => ({
      id: r.id,
      content: r.content,
      tier: r.tier,
      confidence: r.confidence,
    }));
  }
}
