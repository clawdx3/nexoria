import { SetMetadata } from '@nestjs/common';
import { WorkspacePlanTier } from '../../database/entities/workspace.entity';

export const REQUIRE_PLAN_KEY = 'requirePlan';
export const RequirePlan = (...tiers: WorkspacePlanTier[]) => SetMetadata(REQUIRE_PLAN_KEY, tiers);
