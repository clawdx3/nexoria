import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AgentProfile, AgentRole, ModelProvider } from '../../database/entities/agent-profile.entity';
import { CreateAgentProfileDto, UpdateAgentProfileDto, AgentProfileResponseDto } from './dto/create-agent-profile.dto';

@Injectable()
export class AgentProfilesService implements OnModuleInit {
  private readonly logger = new Logger(AgentProfilesService.name);

  constructor(@InjectRepository(AgentProfile) private readonly repo: Repository<AgentProfile>) {}

  async onModuleInit(): Promise<void> {
    await this.removeDeprecatedBuiltInProfiles();
    await this.ensureBuiltInProfiles();
  }

  async create(workspaceId: string | null, dto: CreateAgentProfileDto): Promise<AgentProfileResponseDto> {
    const profile = this.repo.create({
      workspaceId,
      name: dto.name,
      description: dto.description,
      systemPrompt: dto.systemPrompt,
      modelProvider: dto.modelProvider as ModelProvider,
      modelName: dto.modelName,
      modelConfig: dto.modelConfig ?? {},
      enabledTools: dto.enabledTools ?? [],
      role: (dto.role as AgentRole) ?? 'specialist',
      defaultAutonomyLevel: dto.defaultAutonomyLevel ?? 1,
      isBuiltIn: false,
    });
    const saved = await this.repo.save(profile);
    return this.toDto(saved);
  }

  async findOne(id: string): Promise<AgentProfileResponseDto> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('AgentProfile not found');
    return this.toDto(p);
  }

  async findByWorkspace(workspaceId: string): Promise<AgentProfileResponseDto[]> {
    const items = await this.repo.find({ where: [{ workspaceId }, { workspaceId: IsNull(), isBuiltIn: true }], order: { createdAt: 'DESC' } });
    return items.map((i) => this.toDto(i));
  }

  async update(id: string, dto: UpdateAgentProfileDto): Promise<AgentProfileResponseDto> {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private async ensureBuiltInProfiles(): Promise<void> {
    const existing = await this.repo.findOne({
      where: { workspaceId: IsNull(), isBuiltIn: true, name: 'Content Creator' },
    });

    const desired = {
      workspaceId: null,
      name: 'Content Creator',
      description: 'Creates and revises approved social content drafts.',
      systemPrompt: [
        'You are Nexoria Content Creator.',
        'Create concise, brand-safe social post drafts from delegated tasks and user instructions.',
        'For Facebook/social post work, write the draft copy and media brief, then call create_social_post_draft with createReviewTask=true.',
        'Include metadata.source="content_creator_runtime" and metadata.createdByAgentRole="content_creator" when creating a draft.',
        'Use Nexoria tools to create, list, and update social post drafts and related review tasks.',
        'Do not only return the post copy in chat; the durable social post draft and approval are the source of truth.',
        'Do not publish externally or claim content was published unless an approved publishing tool confirms it.',
      ].join(' '),
      modelProvider: (process.env.DEFAULT_MODEL_PROVIDER || 'ollama') as ModelProvider,
      modelName: process.env.OLLAMA_MODEL || process.env.DEFAULT_MODEL_NAME || 'gpt-oss:120b',
      modelConfig: {},
      enabledTools: ['create_task', 'list_tasks', 'update_task_status', 'create_social_post_draft', 'list_social_post_drafts', 'update_social_post_draft'],
      role: 'specialist' as AgentRole,
      defaultAutonomyLevel: 1,
      isBuiltIn: true,
    };

    if (existing) {
      await this.repo.update(existing.id, desired);
      return;
    }

    const profile = this.repo.create(desired);
    await this.repo.save(profile);
    this.logger.log('Seeded built-in Content Creator agent profile');
  }

  private async removeDeprecatedBuiltInProfiles(): Promise<void> {
    const deprecatedNames = ['Dev Agent', 'Developer Agent', 'Development Agent'];
    const deprecated = await this.repo.find({
      where: deprecatedNames.map((name) => ({ workspaceId: IsNull(), isBuiltIn: true, name })),
    });
    if (deprecated.length === 0) return;

    await this.repo.remove(deprecated);
    this.logger.log(`Removed deprecated built-in agent profiles: ${deprecated.map((profile) => profile.name).join(', ')}`);
  }

  private toDto(p: AgentProfile): AgentProfileResponseDto {
    return {
      id: p.id,
      workspaceId: p.workspaceId,
      name: p.name,
      description: p.description,
      systemPrompt: p.systemPrompt,
      modelProvider: p.modelProvider,
      modelName: p.modelName,
      modelConfig: p.modelConfig,
      enabledTools: p.enabledTools,
      role: p.role,
      defaultAutonomyLevel: p.defaultAutonomyLevel,
      isBuiltIn: p.isBuiltIn,
      createdAt: p.createdAt,
    };
  }
}
