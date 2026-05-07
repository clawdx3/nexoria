import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryEntry, MemoryTier, MemoryType } from '../../database/entities/memory-entry.entity';
import { CreateMemoryDto, MemoryResponseDto, SemanticSearchDto } from './dto/create-memory.dto';

@Injectable()
export class MemoryService {
  constructor(@InjectRepository(MemoryEntry) private readonly repo: Repository<MemoryEntry>) {}

  async create(workspaceId: string, dto: CreateMemoryDto): Promise<MemoryResponseDto> {
    const entry = this.repo.create({
      workspaceId,
      userId: dto.userId,
      tier: dto.tier as MemoryTier,
      type: dto.type as MemoryType,
      content: dto.content,
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

  async semanticSearch(workspaceId: string, dto: SemanticSearchDto, embedding: number[]): Promise<MemoryResponseDto[]> {
    // pgvector cosine similarity search using raw SQL
    const limit = dto.limit ?? 10;
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
    };
  }
}
