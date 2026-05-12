import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryEntry } from '../../database/entities/memory-entry.entity';

@Injectable()
export class MemoryOutcomeTrackerService {
  private readonly logger = new Logger(MemoryOutcomeTrackerService.name);

  constructor(
    @InjectRepository(MemoryEntry) private readonly repo: Repository<MemoryEntry>,
  ) {}

  async recordOutcome(memoryIds: string[], success: boolean): Promise<void> {
    if (memoryIds.length === 0) return;

    const column = success ? 'positiveUses' : 'negativeUses';
    try {
      await this.repo
        .createQueryBuilder()
        .update(MemoryEntry)
        .set({
          [column]: () => `"${column}" + 1`,
          lastValidatedAt: new Date(),
        })
        .whereInIds(memoryIds)
        .execute();

      if (success) {
        await this.repo
          .createQueryBuilder()
          .update(MemoryEntry)
          .set({ confidence: () => 'LEAST(confidence + 0.02, 1.0)' })
          .whereInIds(memoryIds)
          .andWhere('confidence < 1.0')
          .execute();
      }

      this.logger.debug(
        `Recorded ${success ? 'positive' : 'negative'} outcome for ${memoryIds.length} memories`,
      );
    } catch (err: any) {
      this.logger.warn(`Failed to record memory outcome: ${err.message}`);
    }
  }
}
