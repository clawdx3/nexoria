import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace, WorkspacePlanTier } from '../../database/entities/workspace.entity';
import { WorkspaceUsage } from '../../database/entities/workspace-usage.entity';

export interface PlanLimits {
  workspaces: number | 'unlimited';
  liteAgents: number | 'unlimited';
  proAgents: number | 'unlimited';
  messagesPerDay: number | 'unlimited';
  storage: number | 'unlimited';
}

const PLAN_LIMITS: Record<WorkspacePlanTier, PlanLimits> = {
  free: {
    workspaces: 1,
    liteAgents: 2,
    proAgents: 0,
    messagesPerDay: 50,
    storage: 100 * 1024 * 1024,
  },
  lite: {
    workspaces: 3,
    liteAgents: 5,
    proAgents: 0,
    messagesPerDay: 500,
    storage: 1024 * 1024 * 1024,
  },
  pro: {
    workspaces: 'unlimited',
    liteAgents: 'unlimited',
    proAgents: 'unlimited',
    messagesPerDay: 'unlimited',
    storage: 10 * 1024 * 1024 * 1024,
  },
  enterprise: {
    workspaces: 'unlimited',
    liteAgents: 'unlimited',
    proAgents: 'unlimited',
    messagesPerDay: 'unlimited',
    storage: 'unlimited',
  },
};

@Injectable()
export class PlanLimitsService {
  constructor(
    @InjectRepository(Workspace) private readonly workspaces: Repository<Workspace>,
    @InjectRepository(WorkspaceUsage) private readonly usage: Repository<WorkspaceUsage>,
  ) {}

  getPlanLimits(planTier: WorkspacePlanTier): PlanLimits {
    return PLAN_LIMITS[planTier] ?? PLAN_LIMITS.free;
  }

  async checkLimit(workspaceId: string, feature: keyof PlanLimits): Promise<void> {
    const workspace = await this.workspaces.findOne({ where: { id: workspaceId } });
    if (!workspace) throw new ForbiddenException('Workspace not found');

    const limits = this.getPlanLimits(workspace.planTier);
    const limit = limits[feature];
    if (limit === 'unlimited') return;

    if (feature === 'messagesPerDay') {
      const today = new Date().toISOString().slice(0, 10);
      const record = await this.usage.findOne({ where: { workspaceId, date: today } });
      const current = record?.messagesSent ?? 0;
      if (current >= (limit as number)) {
        throw new ForbiddenException(
          `Daily message limit reached (${limit}). Upgrade your plan for higher limits.`,
        );
      }
    }
  }
}
