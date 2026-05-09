import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryEntry, MemoryTier, MemoryType } from '../../database/entities/memory-entry.entity';
import { CreateMemoryDto, MemoryResponseDto } from './dto/create-memory.dto';

@Injectable()
export class MemoryService {
  constructor(
    @InjectRepository(MemoryEntry) private readonly repo: Repository<MemoryEntry>,
  ) {}

  async create(workspaceId: string, dto: CreateMemoryDto, opts?: { embedding?: number[] }): Promise<MemoryResponseDto> {
    const entry = this.repo.create({
      workspaceId,
      userId: dto.userId,
      sessionId: dto.sessionId ?? null,
      tier: dto.tier as MemoryTier,
      type: dto.type as MemoryType,
      content: dto.content,
      embedding: opts?.embedding ?? null,
      metadata: dto.metadata ?? {},
      confidence: dto.confidence ?? 1.0,
      expiresAt: dto.expiresAt ?? null,
    });
    const saved = await this.repo.save(entry);
    return this.toDto(saved);
  }

  async findOne(id: string): Promise<MemoryResponseDto> {
    const e = await this.repo.findOne({ where: { id } });
    if (!e) throw new NotFoundException('Memory entry not found');
    return this.toDto(e);
  }

  async findByUser(userId: string, workspaceId: string): Promise<MemoryResponseDto[]> {
    const items = await this.repo.find({
      where: { userId, workspaceId },
      order: { createdAt: 'DESC' },
    });
    return items.map((i) => this.toDto(i));
  }

  async findByWorkspaceUser(workspaceId: string, userId: string): Promise<MemoryResponseDto[]> {
    return this.findByUser(userId, workspaceId);
  }

  async searchByText(workspaceId: string, query: string, limit = 10): Promise<MemoryResponseDto[]> {
    const items = await this.repo
      .createQueryBuilder('m')
      .where('m.workspaceId = :workspaceId', { workspaceId })
      .andWhere('m.content ILIKE :query', { query: `%${query}%` })
      .orderBy('m.confidence', 'DESC')
      .addOrderBy('m.createdAt', 'DESC')
      .limit(limit)
      .getMany();
    return items.map((i) => this.toDto(i));
  }

  async semanticSearch(workspaceId: string, embedding: number[], limit = 10): Promise<MemoryResponseDto[]> {
    const raw = (await this.repo.query(
      `SELECT id, "userId", tier, type, content, metadata, confidence,
              "positiveUses", "negativeUses", "createdAt"
       FROM memory_entries
       WHERE "workspaceId" = $1 AND embedding IS NOT NULL
       ORDER BY embedding <=> $2
       LIMIT $3`,
      [workspaceId, JSON.stringify(embedding), limit],
    )) as Array<{
      id: string;
      userId: string;
      tier: string;
      type: string;
      content: string;
      confidence: number;
      positiveUses: number;
      negativeUses: number;
      createdAt: Date;
    }>;
    return raw.map((r) => ({
      id: r.id,
      workspaceId,
      userId: r.userId,
      tier: r.tier,
      type: r.type,
      content: r.content,
      metadata: {},
      confidence: r.confidence,
      positiveUses: r.positiveUses,
      negativeUses: r.negativeUses,
      createdAt: r.createdAt,
    }));
  }

  async recordUse(id: string, positive: boolean): Promise<void> {
    const column = positive ? 'positiveUses' : 'negativeUses';
    await this.repo.increment({ id }, column, 1);
    await this.repo.update({ id }, { lastValidatedAt: new Date() });
  }

  async touchValidatedAt(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.repo
      .createQueryBuilder()
      .update(MemoryEntry)
      .set({ lastValidatedAt: new Date() })
      .whereInIds(ids)
      .execute();
  }

  private toDto(e: MemoryEntry): MemoryResponseDto {
    return {
      id: e.id,
      workspaceId: e.workspaceId,
      userId: e.userId,
      tier: e.tier,
      type: e.type,
      content: e.content,
      metadata: e.metadata ?? {},
      confidence: e.confidence,
      positiveUses: e.positiveUses,
      negativeUses: e.negativeUses,
      createdAt: e.createdAt,
      lastValidatedAt: e.lastValidatedAt ?? null,
    };
  }
}
