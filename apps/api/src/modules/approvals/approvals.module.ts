import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { Approval } from '../../database/entities/approval.entity';
import { ApprovalDecision } from '../../database/entities/approval-decision.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Approval, ApprovalDecision])],
  providers: [ApprovalsService],
  controllers: [ApprovalsController],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
