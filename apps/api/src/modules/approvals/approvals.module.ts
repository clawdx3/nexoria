import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { Approval } from '../../database/entities/approval.entity';
import { ApprovalDecision } from '../../database/entities/approval-decision.entity';
import { SocialPostDraft } from '../../database/entities/social-post-draft.entity';
import { Task } from '../../database/entities/task.entity';
import { RuntimeInstance } from '../../database/entities/runtime-instance.entity';
import { ProAgentOrJwtGuard } from '../../common/guards/pro-agent-or-jwt.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Approval, ApprovalDecision, SocialPostDraft, Task, RuntimeInstance])],
  providers: [ApprovalsService, ProAgentOrJwtGuard],
  controllers: [ApprovalsController],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
