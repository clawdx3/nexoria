import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { MemoryEntry } from '../../../database/entities/memory-entry.entity';
import { AgentContext } from '../../../shared/interfaces/agent.interfaces';
import { EmbeddingService } from '../embedding/embedding.service';

export interface MemoryContextResult {
  profile: string[];
  session: string[];
  daily: string[];
  longTerm: string[];
  recalledIds: string[];
}

@Injectable()
export class MemoryContextBuilder {
  constructor(
    @InjectRepository(MemoryEntry) private readonly repo: Repository<MemoryEntry>,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async build(ctx: AgentContext, userMessage?: string): Promise<MemoryContextResult> {
    const [profile, session, daily, longTerm] = await Promise.all([
      this.loadTier(ctx, 'profile', 20),
      this.loadTier(ctx, 'session', 50),
      this.loadTier(ctx, 'daily', 30),
      this.loadLongTerm(ctx, userMessage ?? ''),
    ]);
    const recalledIds = [
      ...profile.ids,
      ...session.ids,
      ...daily.ids,
      ...longTerm.ids,
    ];
    return {
      profile: profile.contents,
      session: session.contents,
      daily: daily.contents,
      longTerm: longTerm.contents,
      recalledIds,
    };
  }

  private async loadTier(ctx: AgentContext, tier: string, limit: number): Promise<{ contents: string[]; ids: string[] }> {
    const where: any = {
      workspaceId: ctx.workspaceId,
      userId: ctx.triggeredByUserId,
      tier: tier as any,
    };

    if (tier === 'session' && ctx.sessionId) {
      where.sessionId = ctx.sessionId;
    }

    let entries: MemoryEntry[];
    if (tier === 'daily') {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      entries = await this.repo.find({
        where: { ...where, createdAt: MoreThanOrEqual(oneDayAgo) },
        order: { confidence: 'DESC', createdAt: 'DESC' },
        take: limit,
      });
    } else {
      entries = await this.repo.find({
        where,
        order: { confidence: 'DESC', createdAt: 'DESC' },
        take: limit,
      });
    }

    return {
      contents: entries.map((e) => e.content),
      ids: entries.map((e) => e.id),
    };
  }

  private async loadLongTerm(ctx: AgentContext, query: string): Promise<{ contents: string[]; ids: string[] }> {
    if (!this.embeddingService.isReady() || !query) {
      const entries = await this.repo.find({
        where: {
          workspaceId: ctx.workspaceId,
          userId: ctx.triggeredByUserId,
          tier: 'long_term' as any,
        },
        order: { confidence: 'DESC', createdAt: 'DESC' },
        take: 10,
      });
      this.touchValidated(entries.map((e) => e.id));
      return {
        contents: entries.map((e) => e.content),
        ids: entries.map((e) => e.id),
      };
    }

    try {
      const embedding = await this.embeddingService.embed(query);
      const dim = embedding.length;
      const vectorLiteral = `[${embedding.join(',')}]`;
      const raw = (await this.repo.query(
        `SELECT id, content FROM memory_entries
         WHERE "workspaceId" = $1 AND tier = 'long_term' AND embedding IS NOT NULL
         ORDER BY embedding::vector(${dim}) <=> $2::vector(${dim})
         LIMIT $3`,
        [ctx.workspaceId, vectorLiteral, 10],
      )) as Array<{ id: string; content: string }>;
      this.touchValidated(raw.map((r) => r.id));
      return {
        contents: raw.map((r) => r.content),
        ids: raw.map((r) => r.id),
      };
    } catch {
      const entries = await this.repo.find({
        where: {
          workspaceId: ctx.workspaceId,
          userId: ctx.triggeredByUserId,
          tier: 'long_term' as any,
        },
        order: { confidence: 'DESC', createdAt: 'DESC' },
        take: 10,
      });
      this.touchValidated(entries.map((e) => e.id));
      return {
        contents: entries.map((e) => e.content),
        ids: entries.map((e) => e.id),
      };
    }
  }

  private touchValidated(ids: string[]): void {
    if (ids.length === 0) return;
    void this.repo
      .createQueryBuilder()
      .update(MemoryEntry)
      .set({ lastValidatedAt: new Date() })
      .whereInIds(ids)
      .execute()
      .catch(() => undefined);
  }

  formatForPrompt(memory: MemoryContextResult): string {
    const sections: string[] = [];
    if (memory.profile.length) sections.push('Profile facts:\n' + memory.profile.map((m) => `- ${m}`).join('\n'));
    if (memory.session.length) sections.push('Session context:\n' + memory.session.map((m) => `- ${m}`).join('\n'));
    if (memory.daily.length) sections.push('Today:\n' + memory.daily.map((m) => `- ${m}`).join('\n'));
    if (memory.longTerm.length) sections.push('Long-term memory:\n' + memory.longTerm.map((m) => `- ${m}`).join('\n'));
    return sections.join('\n\n');
  }
}
