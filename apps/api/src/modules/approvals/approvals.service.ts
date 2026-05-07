import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Approval, ApprovalStatus } from '../../database/entities/approval.entity';
import { ApprovalDecision, DecisionOutcome } from '../../database/entities/approval-decision.entity';
import { CreateApprovalDto, SubmitDecisionDto, ApprovalResponseDto } from './dto/create-approval.dto';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(Approval) private readonly repo: Repository<Approval>,
    @InjectRepository(ApprovalDecision) private readonly decisionRepo: Repository<ApprovalDecision>,
  ) {}

  async create(workspaceId: string, dto: CreateApprovalDto): Promise<ApprovalResponseDto> {
    const approval = this.repo.create({
      workspaceId,
      type: dto.type as any,
      title: dto.title,
      description: dto.description,
      taskId: dto.taskId,
      missionId: dto.missionId,
      draftId: dto.draftId,
      metadata: dto.metadata ?? {},
    });
    const saved = await this.repo.save(approval);
    return this.toDto(saved);
  }

  async findOne(id: string): Promise<ApprovalResponseDto> {
    const a = await this.repo.findOne({ where: { id }, relations: ['decisions'] });
    if (!a) throw new NotFoundException('Approval not found');
    return this.toDto(a);
  }

  async findByWorkspace(workspaceId: string): Promise<ApprovalResponseDto[]> {
    const items = await this.repo.find({ where: { workspaceId }, order: { createdAt: 'DESC' } });
    return items.map((i) => this.toDto(i));
  }

  async submitDecision(approvalId: string, decidedById: string, dto: SubmitDecisionDto): Promise<ApprovalResponseDto> {
    const approval = await this.repo.findOne({ where: { id: approvalId } });
    if (!approval) throw new NotFoundException('Approval not found');

    const decision = this.decisionRepo.create({
      approvalId,
      decidedById,
      outcome: dto.outcome as DecisionOutcome,
      reason: dto.reason,
    });
    await this.decisionRepo.save(decision);

    let newStatus: ApprovalStatus = approval.status;
    if (dto.outcome === 'approve') newStatus = 'approved';
    else if (dto.outcome === 'reject') newStatus = 'rejected';
    else if (dto.outcome === 'request_changes') newStatus = 'pending';
    else if (dto.outcome === 'escalate') newStatus = 'escalated';

    await this.repo.update(approvalId, { status: newStatus, requestedChanges: dto.outcome === 'request_changes' ? { reason: dto.reason } : undefined });
    return this.findOne(approvalId);
  }

  private toDto(a: Approval): ApprovalResponseDto {
    return {
      id: a.id,
      type: a.type,
      status: a.status,
      title: a.title,
      createdAt: a.createdAt,
    };
  }
}
