import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Approval, ApprovalStatus } from '../../database/entities/approval.entity';
import { ApprovalDecision, DecisionOutcome } from '../../database/entities/approval-decision.entity';
import { SocialPostDraft } from '../../database/entities/social-post-draft.entity';
import { Task } from '../../database/entities/task.entity';
import { CreateApprovalDto, SubmitDecisionDto, ApprovalResponseDto } from './dto/create-approval.dto';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectRepository(Approval) private readonly repo: Repository<Approval>,
    @InjectRepository(ApprovalDecision) private readonly decisionRepo: Repository<ApprovalDecision>,
    @InjectRepository(SocialPostDraft) private readonly socialPostDrafts: Repository<SocialPostDraft>,
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
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

    const update: Partial<Approval> = { status: newStatus };
    if (dto.outcome === 'request_changes') {
      update.requestedChanges = { reason: dto.reason };
    }
    await this.repo.update(approvalId, update);
    await this.applyDecisionSideEffects(approval, dto, newStatus);
    return this.findOne(approvalId);
  }

  private async applyDecisionSideEffects(approval: Approval, dto: SubmitDecisionDto, status: ApprovalStatus): Promise<void> {
    const socialPostDraftId = approval.metadata?.socialPostDraftId as string | undefined;
    if (!socialPostDraftId) return;

    const draftStatus = dto.outcome === 'approve'
      ? 'approved'
      : dto.outcome === 'reject'
        ? 'rejected'
        : dto.outcome === 'request_changes'
          ? 'review'
          : undefined;

    if (draftStatus) {
      const draft = await this.socialPostDrafts.findOne({ where: { id: socialPostDraftId } });
      if (draft) {
        draft.status = draftStatus as any;
        draft.metadata = {
          ...(draft.metadata ?? {}),
          ...(approval.metadata ?? {}),
          approvalId: approval.id,
          approvalStatus: status,
          approvalDecision: dto.outcome,
          approvalReason: dto.reason,
        };
        await this.socialPostDrafts.save(draft);
      }
    }

    if (approval.taskId) {
      const task = await this.tasks.findOne({ where: { id: approval.taskId } });
      if (!task) return;
      if (dto.outcome === 'approve') {
        task.status = 'done';
        task.metadata = {
          ...(task.metadata ?? {}),
          waitingApproval: false,
          approvalId: approval.id,
          approvalStatus: 'approved',
          socialPostDraftId,
          handoffQueued: false,
          handoffStatus: 'completed',
          nextStep: 'ready_for_publish',
          approvedAt: new Date().toISOString(),
        };
        await this.tasks.save(task);
      } else if (dto.outcome === 'reject') {
        task.status = 'cancelled';
        task.metadata = {
          ...(task.metadata ?? {}),
          waitingApproval: false,
          approvalId: approval.id,
          approvalStatus: 'rejected',
          socialPostDraftId,
          rejectionReason: dto.reason,
        };
        await this.tasks.save(task);
      } else if (dto.outcome === 'request_changes') {
        task.metadata = {
          ...(task.metadata ?? {}),
          waitingApproval: true,
          approvalId: approval.id,
          approvalStatus: 'changes_requested',
          socialPostDraftId,
          requestedChanges: dto.reason,
        };
        await this.tasks.save(task);
      }
    }
  }

  private toDto(a: Approval): ApprovalResponseDto {
    return {
      id: a.id,
      workspaceId: a.workspaceId,
      type: a.type,
      status: a.status,
      title: a.title,
      description: a.description,
      taskId: a.taskId,
      missionId: a.missionId,
      draftId: a.draftId,
      metadata: a.metadata ?? {},
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}
