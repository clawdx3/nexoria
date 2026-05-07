import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryEntry } from '../../../database/entities/memory-entry.entity';
import { AgentContext } from '../../../shared/interfaces/agent.interfaces';

export interface MemoryContextResult {
  profile: MemoryEntry[];
  session: MemoryEntry[];
  daily: MemoryEntry[];
  longTerm: MemoryEntry[];
}

@Injectable()
export class MemoryContextBuilder {
  constructor(@InjectRepository(MemoryEntry) private readonly repo: Repository<MemoryEntry>) {}

  async build(ctx: AgentContext): Promise<MemoryContextResult> {
    const [profile, session, daily, longTerm] = await Promise.all([
      this.loadTier(ctx, 'profile', 20),
      this.loadTier(ctx, 'session', 50),
      this.loadTier(ctx, 'daily', 30),
      this.loadTier(ctx, 'long_term', 10),
    ]);
    return { profile, session, daily, longTerm };
  }

  private async loadTier(ctx: AgentContext, tier: string, limit: number): Promise<MemoryEntry[]> {
    return this.repo.find({
      where: {
        workspaceId: ctx.workspaceId,
        userId: ctx.triggeredByUserId,
        tier: tier as any,
      },
      order: { confidence: 'DESC', createdAt: 'DESC' },
      take: limit,
    });
  }

  formatForPrompt(memory: MemoryContextResult): string {
    const sections: string[] = [];
    if (memory.profile.length) sections.push(`Profile facts:\n${memory.profile.map((m) => `- ${m.content}`).join('\n')}`);
    if (memory.session.length) sections.push(`Session context:\n${memory.session.map((m) => `- ${m.content}`).join('\n')}`);
    if (memory.daily.length) sections.push(`Today:\n${memory.daily.map((m) => `- ${m.content}`).join('\n')}`);
    if (memory.longTerm.length) sections.push(`Long-term memory:\n${memory.longTerm.map((m) => `- ${m.content}`).join('\n')}`);
    return sections.join('\n\n');
  }
}
