import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AgentProfile, AgentRole, ModelProvider } from '../../database/entities/agent-profile.entity';
import { CreateAgentProfileDto, UpdateAgentProfileDto, AgentProfileResponseDto } from './dto/create-agent-profile.dto';

@Injectable()
export class AgentProfilesService {
  constructor(@InjectRepository(AgentProfile) private readonly repo: Repository<AgentProfile>) {}

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
