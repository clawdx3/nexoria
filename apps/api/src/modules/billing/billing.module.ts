import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from '../../database/entities/workspace.entity';
import { WorkspaceUsage } from '../../database/entities/workspace-usage.entity';
import { PlanLimitsService } from './plan-limits.service';
import { UsageTrackingService } from './usage-tracking.service';

@Module({
  imports: [TypeOrmModule.forFeature([Workspace, WorkspaceUsage])],
  providers: [PlanLimitsService, UsageTrackingService],
  exports: [PlanLimitsService, UsageTrackingService],
})
export class BillingModule {}
