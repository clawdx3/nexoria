import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace, WorkspacePlanTier } from '../../database/entities/workspace.entity';
import { REQUIRE_PLAN_KEY } from '../decorators/require-plan.decorator';

const TIER_ORDER: WorkspacePlanTier[] = ['free', 'lite', 'pro', 'enterprise'];

@Injectable()
export class PlanTierGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Workspace) private readonly workspaces: Repository<Workspace>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredTiers = this.reflector.getAllAndOverride<WorkspacePlanTier[]>(REQUIRE_PLAN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredTiers || requiredTiers.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const workspaceId = request.params?.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace ID is required');

    const workspace = await this.workspaces.findOne({ where: { id: workspaceId } });
    if (!workspace) throw new ForbiddenException('Workspace not found');

    const currentTierIndex = TIER_ORDER.indexOf(workspace.planTier);
    const meetsTier = requiredTiers.some((tier) => currentTierIndex >= TIER_ORDER.indexOf(tier));

    if (!meetsTier) {
      throw new ForbiddenException(
        `This feature requires one of the following plans: ${requiredTiers.join(', ')}. Current plan: ${workspace.planTier}.`,
      );
    }

    return true;
  }
}
