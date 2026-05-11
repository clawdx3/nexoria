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
      isEnabled: dto.isEnabled ?? true,
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
    return this.mergeWorkspaceOverrides(items).map((i) => this.toDto(i));
  }

  async findEnabledByWorkspace(workspaceId: string): Promise<AgentProfileResponseDto[]> {
    const items = await this.findByWorkspace(workspaceId);
    return items.filter((i) => i.isEnabled !== false);
  }

  async update(id: string, dto: UpdateAgentProfileDto, workspaceId?: string): Promise<AgentProfileResponseDto> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('AgentProfile not found');

    if (workspaceId && existing.isBuiltIn && existing.workspaceId === null && this.isEnableOnlyUpdate(dto)) {
      const override = await this.repo.findOne({ where: { workspaceId, isBuiltIn: true, name: existing.name } });
      const patch = this.builtInWorkspaceOverride(existing, workspaceId, dto.isEnabled ?? true);
      if (override) {
        await this.repo.update(override.id, patch);
        return this.findOne(override.id);
      }
      const saved = await this.repo.save(this.repo.create(patch));
      return this.toDto(saved);
    }

    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private async ensureBuiltInProfiles(): Promise<void> {
    const modelProvider = (process.env.DEFAULT_MODEL_PROVIDER || 'ollama') as ModelProvider;
    const modelName = process.env.OLLAMA_MODEL || process.env.DEFAULT_MODEL_NAME || 'gpt-oss:120b';
    const builtIns: Array<Partial<AgentProfile> & { name: string; systemPrompt: string; enabledTools: string[]; legacyNames?: string[] }> = [
      {
        name: 'Social Media Agent',
        description: 'Creates and revises social media drafts for review.',
        systemPrompt: [
          'You are Nexoria Social Media Agent.',
          'Create concise, brand-safe social post drafts from delegated tasks and user instructions.',
          'For Facebook/social post work, write the draft copy and media brief, then call create_social_post_draft with createReviewTask=true.',
          'Include metadata.source="social_media_agent_runtime" and metadata.createdByAgentRole="social_media_agent" when creating a draft.',
          'Use Nexoria tools to create, list, and update social post drafts and related review tasks.',
          'Do not only return the post copy in chat; the durable social post draft and approval are the source of truth.',
          'Do not publish externally or claim content was published unless an approved publishing tool confirms it.',
        ].join(' '),
        enabledTools: ['create_task', 'list_tasks', 'update_task_status', 'create_social_post_draft', 'list_social_post_drafts', 'update_social_post_draft'],
      },
      {
        name: 'Research Agent',
        description: 'Researches topics, summarizes findings, and creates follow-up tasks.',
        systemPrompt: [
          'You are Nexoria Research Agent.',
          'Research user-provided topics, collect useful findings, and produce concise summaries with sources when available.',
          'Create Nexoria tasks for follow-up work when the research uncovers clear next actions.',
          'Do not claim external facts are verified unless you actually used available tools or provided uncertainty.',
        ].join(' '),
        enabledTools: ['create_task', 'list_tasks', 'update_task_status'],
      },
      {
        name: 'Email Inbox Agent',
        legacyNames: ['Inbox Agent'],
        description: 'Helps read, triage, and draft replies for user email.',
        systemPrompt: [
          'You are Nexoria Email Inbox Agent.',
          'Help triage email, prepare reply drafts, identify follow-up tasks, and summarize threads when email integrations are available.',
          'Do not send emails, modify credentials, or contact people externally without Nexoria approval and an explicit sending tool result.',
          'When integrations are not connected, explain what is missing and create setup or follow-up tasks when useful.',
        ].join(' '),
        enabledTools: ['create_task', 'list_tasks', 'update_task_status'],
      },
      {
        name: 'Email Campaigns Agent',
        legacyNames: ['Email Campaign Agent'],
        description: 'Plans and drafts email campaigns, sequences, and review tasks.',
        systemPrompt: [
          'You are Nexoria Email Campaigns Agent.',
          'Plan email campaigns, draft campaign copy, outline audience/segment assumptions, and create review tasks.',
          'Do not send campaigns, upload audiences, spend money, or change marketing automation settings without Nexoria approval and a successful integration tool result.',
        ].join(' '),
        enabledTools: ['create_task', 'list_tasks', 'update_task_status'],
      },
    ];

    for (const desired of builtIns) {
      const existing = await this.repo.findOne({
        where: [
          { workspaceId: IsNull(), isBuiltIn: true, name: desired.name },
          ...((desired.legacyNames ?? []).map((name) => ({ workspaceId: IsNull(), isBuiltIn: true, name }))),
          ...(desired.name === 'Social Media Agent' ? [{ workspaceId: IsNull(), isBuiltIn: true, name: 'Content Creator' }] : []),
        ],
      });
      const patch = {
        workspaceId: null,
        name: desired.name,
        description: desired.description,
        systemPrompt: desired.systemPrompt,
        modelProvider,
        modelName,
        modelConfig: {},
        enabledTools: desired.enabledTools,
        role: 'specialist' as AgentRole,
        defaultAutonomyLevel: 1,
        isBuiltIn: true,
        isEnabled: existing?.isEnabled ?? true,
      };
      if (existing) {
        await this.repo.update(existing.id, patch);
      } else {
        await this.repo.save(this.repo.create(patch));
        this.logger.log(`Seeded built-in ${desired.name} agent profile`);
      }
    }
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

  private mergeWorkspaceOverrides(items: AgentProfile[]): AgentProfile[] {
    const overrideNames = new Set(
      items
        .filter((item) => item.workspaceId !== null && item.isBuiltIn)
        .map((item) => item.name),
    );
    return items.filter((item) => !(item.workspaceId === null && item.isBuiltIn && overrideNames.has(item.name)));
  }

  private isEnableOnlyUpdate(dto: UpdateAgentProfileDto): boolean {
    const keys = Object.keys(dto);
    return keys.length === 1 && keys[0] === 'isEnabled';
  }

  private builtInWorkspaceOverride(base: AgentProfile, workspaceId: string, isEnabled: boolean): Partial<AgentProfile> {
    return {
      workspaceId,
      name: base.name,
      description: base.description,
      systemPrompt: base.systemPrompt,
      modelProvider: base.modelProvider,
      modelName: base.modelName,
      modelConfig: base.modelConfig,
      enabledTools: base.enabledTools,
      role: base.role,
      defaultAutonomyLevel: base.defaultAutonomyLevel,
      isBuiltIn: true,
      isEnabled,
    };
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
      isEnabled: p.isEnabled ?? true,
      runtimeMode: p.runtimeMode ?? 'openclaw',
      planTier: p.planTier ?? 'economy',
      remoteConfig: p.remoteConfig ?? {},
      createdAt: p.createdAt,
    };
  }
}
