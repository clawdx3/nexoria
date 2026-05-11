import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { WorkspaceUsage } from '../../database/entities/workspace-usage.entity';

export interface TrackEvent {
  messagesSent?: number;
  agentRuntimeMinutes?: number;
  vpsHours?: number;
  tokensUsed?: number;
  toolInvocations?: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class UsageTrackingService {
  constructor(
    @InjectRepository(WorkspaceUsage) private readonly usage: Repository<WorkspaceUsage>,
  ) {}

  async track(workspaceId: string, event: TrackEvent): Promise<WorkspaceUsage> {
    const today = new Date().toISOString().slice(0, 10);
    let record = await this.usage.findOne({ where: { workspaceId, date: today } });

    if (!record) {
      record = this.usage.create({ workspaceId, date: today });
    }

    if (event.messagesSent) record.messagesSent += event.messagesSent;
    if (event.agentRuntimeMinutes) record.agentRuntimeMinutes += event.agentRuntimeMinutes;
    if (event.vpsHours) record.vpsHours = Number(record.vpsHours) + event.vpsHours;
    if (event.tokensUsed) record.tokensUsed += event.tokensUsed;
    if (event.toolInvocations) record.toolInvocations += event.toolInvocations;
    if (event.metadata) {
      record.metadata = { ...(record.metadata ?? {}), ...event.metadata };
    }

    return this.usage.save(record);
  }

  async getUsage(workspaceId: string, startDate: string, endDate: string): Promise<WorkspaceUsage[]> {
    return this.usage.find({
      where: { workspaceId, date: Between(startDate, endDate) },
      order: { date: 'ASC' },
    });
  }

  async getCurrentUsage(workspaceId: string): Promise<WorkspaceUsage | null> {
    const today = new Date().toISOString().slice(0, 10);
    return this.usage.findOne({ where: { workspaceId, date: today } });
  }
}
