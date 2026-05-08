import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Approval } from '../../database/entities/approval.entity';
import { SocialPostDraft } from '../../database/entities/social-post-draft.entity';
import { TasksService } from '../tasks/tasks.service';
import { CreateSocialPostDraftDto, SocialPostDraftResponseDto, UpdateSocialPostDraftDto } from './dto/social-post-draft.dto';

@Injectable()
export class SocialPostDraftsService {
  constructor(
    @InjectRepository(SocialPostDraft) private readonly repo: Repository<SocialPostDraft>,
    @InjectRepository(Approval) private readonly approvals: Repository<Approval>,
    private readonly tasks: TasksService,
  ) {}

  async create(workspaceId: string, dto: CreateSocialPostDraftDto): Promise<SocialPostDraftResponseDto> {
    let taskId = dto.taskId ?? null;
    const source = dto.metadata?.source ?? null;
    const createdByAgentRole = dto.metadata?.createdByAgentRole ?? null;
    if (!taskId && dto.createReviewTask) {
      const task = await this.tasks.create(workspaceId, {
        title: `Review ${dto.platform ?? 'facebook'} post: ${dto.title}`,
        description: [
          dto.topic ? `Topic: ${dto.topic}` : null,
          dto.mediaBrief ? `Media brief: ${dto.mediaBrief}` : null,
          'Review the generated social post draft before publishing.',
        ].filter(Boolean).join('\n'),
        priority: 'medium',
        tags: ['social-post', dto.platform ?? 'facebook'],
        metadata: {
          createdByTool: 'mcp:create_social_post_draft',
          source,
          createdByAgentRole,
          draftTitle: dto.title,
          waitingApproval: true,
          nextStep: 'user_review',
        },
      });
      taskId = task.id;
    }

    const draft = this.repo.create({
      workspaceId,
      platform: dto.platform ?? 'facebook',
      title: dto.title,
      topic: dto.topic ?? null,
      copy: dto.copy,
      mediaBrief: dto.mediaBrief ?? null,
      status: dto.status ?? (dto.createReviewTask ? 'review' : 'draft'),
      scheduledFor: dto.scheduledFor ?? null,
      taskId,
      metadata: dto.metadata ?? {},
    });
    const saved = await this.repo.save(draft);

    if (dto.createReviewTask) {
      const approval = await this.approvals.save(this.approvals.create({
        workspaceId,
        type: 'draft',
        title: `Approve ${saved.platform} post: ${saved.title}`,
        description: saved.topic || saved.mediaBrief || 'Review social post draft before publishing.',
        ...(taskId ? { taskId } : {}),
        metadata: {
          subtype: 'social',
          socialPostDraftId: saved.id,
          platform: saved.platform,
          caption: saved.copy,
          mediaBrief: saved.mediaBrief,
          scheduledFor: saved.scheduledFor,
          source,
          createdByAgentRole,
          nextStep: 'ready_for_publish_after_approval',
        },
      }));
      saved.metadata = {
        ...(saved.metadata ?? {}),
        approvalId: approval.id,
        approvalStatus: approval.status,
        nextStep: 'user_review',
      };
      await this.repo.save(saved);
      return this.findOne(saved.id);
    }

    return this.toDto(saved);
  }

  async findByWorkspace(workspaceId: string): Promise<SocialPostDraftResponseDto[]> {
    const drafts = await this.repo.find({ where: { workspaceId }, order: { createdAt: 'DESC' } });
    return drafts.map((draft) => this.toDto(draft));
  }

  async findOne(id: string): Promise<SocialPostDraftResponseDto> {
    const draft = await this.repo.findOne({ where: { id } });
    if (!draft) throw new NotFoundException('Social post draft not found');
    return this.toDto(draft);
  }

  async update(id: string, dto: UpdateSocialPostDraftDto): Promise<SocialPostDraftResponseDto> {
    await this.repo.update(id, {
      ...dto,
      topic: dto.topic === undefined ? undefined : dto.topic,
      mediaBrief: dto.mediaBrief === undefined ? undefined : dto.mediaBrief,
      scheduledFor: dto.scheduledFor === undefined ? undefined : dto.scheduledFor,
      metadata: dto.metadata === undefined ? undefined : dto.metadata,
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private toDto(draft: SocialPostDraft): SocialPostDraftResponseDto {
    return {
      id: draft.id,
      workspaceId: draft.workspaceId,
      platform: draft.platform,
      title: draft.title,
      topic: draft.topic,
      copy: draft.copy,
      mediaBrief: draft.mediaBrief,
      status: draft.status,
      scheduledFor: draft.scheduledFor,
      taskId: draft.taskId,
      metadata: draft.metadata ?? {},
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }
}
