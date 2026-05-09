import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryEntry } from '../../database/entities/memory-entry.entity';
import { EmbeddingService } from '../agent-runtime/embedding/embedding.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const DECAY_AFTER_DAYS = Number(process.env.MEMORY_DECAY_AFTER_DAYS || 14);
const DECAY_FACTOR = Number(process.env.MEMORY_DECAY_FACTOR || 0.95);
const DECAY_FLOOR = Number(process.env.MEMORY_DECAY_FLOOR || 0.1);

const SESSION_PROMOTE_USES = Number(process.env.MEMORY_SESSION_PROMOTE_USES || 2);
const SESSION_PROMOTE_CONFIDENCE = Number(process.env.MEMORY_SESSION_PROMOTE_CONFIDENCE || 0.6);

const DAILY_PROMOTE_AGE_DAYS = Number(process.env.MEMORY_DAILY_PROMOTE_AGE_DAYS || 7);
const DAILY_PROMOTE_CONFIDENCE = Number(process.env.MEMORY_DAILY_PROMOTE_CONFIDENCE || 0.7);

const HARD_DELETE_NEGATIVE_USES = Number(process.env.MEMORY_HARD_DELETE_NEGATIVE_USES || 3);
const HARD_DELETE_CONFIDENCE = Number(process.env.MEMORY_HARD_DELETE_CONFIDENCE || 0.05);

/**
 * Memory lifecycle: decay unused entries, promote validated ones up the
 * tier ladder, hard-delete entries that have decayed below the floor or
 * been negatively reviewed too many times.
 *
 * Runs once per day via @nestjs/schedule cron. Each phase is independent
 * so thresholds can be tuned without touching others, and so phases can
 * be invoked manually from tests.
 */
@Injectable()
export class MemoryLifecycleService {
  private readonly logger = new Logger(MemoryLifecycleService.name);

  constructor(
    @InjectRepository(MemoryEntry) private readonly repo: Repository<MemoryEntry>,
    private readonly embedding: EmbeddingService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runDailyMaintenance(): Promise<void> {
    this.logger.log('Running daily memory lifecycle maintenance');
    const decayed = await this.applyDecay();
    const promotedToDaily = await this.promoteSessionToDaily();
    const promotedToLong = await this.promoteDailyToLongTerm();
    const expired = await this.hardDeleteExpired();
    this.logger.log(
      `Memory lifecycle: decayed=${decayed} session→daily=${promotedToDaily} daily→long_term=${promotedToLong} deleted=${expired}`,
    );
  }

  async applyDecay(): Promise<number> {
    const cutoff = new Date(Date.now() - DECAY_AFTER_DAYS * DAY_MS);
    const result = await this.repo
      .createQueryBuilder()
      .update(MemoryEntry)
      .set({ confidence: () => `GREATEST(${DECAY_FLOOR}::float, confidence * ${DECAY_FACTOR}::float)` })
      .where('COALESCE("lastValidatedAt", "createdAt") < :cutoff', { cutoff })
      .andWhere('confidence > :floor', { floor: DECAY_FLOOR })
      .execute();
    return result.affected ?? 0;
  }

  async promoteSessionToDaily(): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .update(MemoryEntry)
      .set({ tier: 'daily' as any, sessionId: null })
      .where('tier = :t', { t: 'session' })
      .andWhere('"positiveUses" >= :u', { u: SESSION_PROMOTE_USES })
      .andWhere('confidence > :c', { c: SESSION_PROMOTE_CONFIDENCE })
      .execute();
    return result.affected ?? 0;
  }

  async promoteDailyToLongTerm(): Promise<number> {
    const ageCutoff = new Date(Date.now() - DAILY_PROMOTE_AGE_DAYS * DAY_MS);
    const candidates = await this.repo
      .createQueryBuilder('m')
      .where('m.tier = :t', { t: 'daily' })
      .andWhere('m."createdAt" <= :cutoff', { cutoff: ageCutoff })
      .andWhere('m.confidence > :c', { c: DAILY_PROMOTE_CONFIDENCE })
      .limit(200)
      .getMany();

    if (candidates.length === 0) return 0;

    let promoted = 0;
    for (const entry of candidates) {
      let embedding: number[] | null = entry.embedding ?? null;
      if (!embedding && this.embedding.isReady()) {
        try { embedding = await this.embedding.embed(entry.content); } catch { embedding = null; }
      }
      await this.repo.update({ id: entry.id }, {
        tier: 'long_term' as any,
        sessionId: null,
        embedding,
      });
      promoted += 1;
    }
    return promoted;
  }

  async hardDeleteExpired(): Promise<number> {
    const now = new Date();
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .where('"expiresAt" IS NOT NULL AND "expiresAt" < :now', { now })
      .orWhere('("negativeUses" >= :nu AND "positiveUses" = 0)', { nu: HARD_DELETE_NEGATIVE_USES })
      .orWhere('confidence < :c', { c: HARD_DELETE_CONFIDENCE })
      .execute();
    return result.affected ?? 0;
  }
}
