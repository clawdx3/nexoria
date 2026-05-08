import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration, IntegrationType, IntegrationStatus } from '../../database/entities/integration.entity';
import { CreateIntegrationDto, UpdateIntegrationDto, IntegrationResponseDto } from './dto/create-integration.dto';

@Injectable()
export class IntegrationsService {
  constructor(@InjectRepository(Integration) private readonly repo: Repository<Integration>) {}

  async create(workspaceId: string, dto: CreateIntegrationDto): Promise<IntegrationResponseDto> {
    const integration = this.repo.create({
      workspaceId,
      type: dto.type as IntegrationType,
      name: dto.name,
      credentials: dto.credentials ?? {},
      settings: dto.settings ?? {},
    });
    const saved = await this.repo.save(integration);
    return this.toDto(saved);
  }

  async findOne(id: string): Promise<IntegrationResponseDto> {
    const i = await this.repo.findOne({ where: { id } });
    if (!i) throw new NotFoundException('Integration not found');
    return this.toDto(i);
  }

  async findByWorkspace(workspaceId: string): Promise<IntegrationResponseDto[]> {
    const items = await this.repo.find({ where: { workspaceId }, order: { createdAt: 'DESC' } });
    return items.map((i) => this.toDto(i));
  }

  async findByWorkspaceAndType(workspaceId: string, type: IntegrationType): Promise<Integration | null> {
    return this.repo.findOne({ where: { workspaceId, type }, order: { updatedAt: 'DESC' } });
  }

  async selectFacebookPage(workspaceId: string, pageId?: string, pageName?: string): Promise<IntegrationResponseDto> {
    const integration = await this.findByWorkspaceAndType(workspaceId, 'facebook');
    if (!integration) throw new NotFoundException('Facebook integration not found');
    await this.update(integration.id, {
      credentials: { ...(integration.credentials || {}), pageId, pageName },
    });
    return this.findOne(integration.id);
  }

  async selectInstagramAccount(workspaceId: string, pageId?: string, accountId?: string): Promise<IntegrationResponseDto> {
    const integration = await this.findByWorkspaceAndType(workspaceId, 'instagram');
    if (!integration) throw new NotFoundException('Instagram integration not found');
    await this.update(integration.id, {
      credentials: { ...(integration.credentials || {}), pageId, instagramAccountId: accountId },
    });
    return this.findOne(integration.id);
  }

  async update(id: string, dto: Partial<Pick<Integration, 'name' | 'status' | 'credentials' | 'settings' | 'metadata' | 'lastSyncedAt' | 'expiresAt'>>): Promise<IntegrationResponseDto> {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private toDto(i: Integration): IntegrationResponseDto {
    return {
      id: i.id,
      type: i.type,
      name: i.name,
      status: i.status,
      lastSyncedAt: i.lastSyncedAt,
      createdAt: i.createdAt,
    };
  }
}
