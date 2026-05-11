import { Injectable } from '@nestjs/common';
import { AgentProfile } from '../../../database/entities/agent-profile.entity';
import { MemoryAdapter } from './memory-adapter.interface';
import { DbMemoryAdapter } from './db-memory.adapter';

@Injectable()
export class MemoryRouterService {
  constructor(
    private readonly dbMemoryAdapter: DbMemoryAdapter,
  ) {}

  resolveAdapters(profile: AgentProfile): MemoryAdapter[] {
    const config = (profile.memoryConfig ?? {}) as Record<string, any>;
    const mode = config.mode ?? 'db';
    switch (mode) {
      case 'db':
        return [this.dbMemoryAdapter];
      case 'local':
        return [];
      case 'hybrid':
        return [this.dbMemoryAdapter];
      default:
        return [this.dbMemoryAdapter];
    }
  }
}
