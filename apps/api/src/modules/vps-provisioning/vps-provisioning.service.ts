import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VpsInstance, VpsStatus } from '../../database/entities/vps-instance.entity';
import { CreateVpsDto, VpsActionDto, VpsResponseDto } from './dto/vps.dto';
import { HetznerAdapter } from './providers/hetzner.adapter';
import { VpsProviderAdapter } from './providers/vps-provider.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class VpsProvisioningService {
  private readonly logger = new Logger(VpsProvisioningService.name);

  constructor(
    @InjectRepository(VpsInstance)
    private readonly repo: Repository<VpsInstance>,
    private readonly hetzner: HetznerAdapter,
  ) {}

  private getProvider(provider: string): VpsProviderAdapter {
    switch (provider) {
      case 'hetzner':
        return this.hetzner;
      default:
        throw new BadRequestException(`Unsupported VPS provider: ${provider}`);
    }
  }

  async provision(workspaceId: string, dto: CreateVpsDto): Promise<VpsResponseDto> {
    const provider = this.getProvider(dto.provider);
    const name = `nexoria-${workspaceId.slice(0, 8)}-${Date.now()}`;
    const userData = this.loadCloudInit();

    const server = await provider.createServer({
      name,
      region: dto.region,
      size: dto.size,
      userData,
      labels: { workspaceId, managedBy: 'nexoria' },
    });

    const instance = this.repo.create({
      workspaceId,
      provider: dto.provider,
      providerInstanceId: server.id,
      region: dto.region,
      size: dto.size,
      ipAddress: server.ipAddress ?? undefined,
      status: server.status as VpsStatus,
      costPerHour: server.costPerHour,
      totalCost: 0,
      metadata: server.metadata,
    });

    const saved = await this.repo.save(instance) as VpsInstance;
    this.logger.log(`Provisioned VPS ${saved.id} (${dto.provider}:${server.id}) for workspace ${workspaceId}`);
    return this.toDto(saved);
  }

  async decommission(instanceId: string): Promise<void> {
    const instance = await this.repo.findOne({ where: { id: instanceId } });
    if (!instance) throw new NotFoundException('VPS instance not found');

    const provider = this.getProvider(instance.provider);

    await this.repo.update(instanceId, { status: 'destroying' });

    try {
      await provider.deleteServer(instance.providerInstanceId);
      await this.repo.delete(instanceId);
      this.logger.log(`Decommissioned VPS ${instanceId}`);
    } catch (err) {
      await this.repo.update(instanceId, { status: 'error' });
      this.logger.error(`Failed to decommission VPS ${instanceId}: ${err}`);
      throw err;
    }
  }

  async getStatus(instanceId: string): Promise<VpsResponseDto> {
    const instance = await this.repo.findOne({ where: { id: instanceId } });
    if (!instance) throw new NotFoundException('VPS instance not found');

    const provider = this.getProvider(instance.provider);
    try {
      const server = await provider.getServer(instance.providerInstanceId);
      await this.repo.update(instanceId, {
        status: server.status as VpsStatus,
        ipAddress: server.ipAddress ?? undefined,
        costPerHour: server.costPerHour,
        metadata: { ...instance.metadata, ...server.metadata },
      });
      const updated = await this.repo.findOne({ where: { id: instanceId } });
      return this.toDto(updated!);
    } catch (err) {
      this.logger.error(`Failed to get status for VPS ${instanceId}: ${err}`);
      return this.toDto(instance);
    }
  }

  async performAction(instanceId: string, dto: VpsActionDto): Promise<VpsResponseDto> {
    const instance = await this.repo.findOne({ where: { id: instanceId } });
    if (!instance) throw new NotFoundException('VPS instance not found');

    if (dto.action === 'destroy') {
      await this.decommission(instanceId);
      return {
        ...this.toDto(instance),
        status: 'destroying',
      };
    }

    switch (dto.action) {
      case 'start':
        throw new BadRequestException('Start action requires provider-specific power API (not yet implemented)');
      case 'stop':
        throw new BadRequestException('Stop action requires provider-specific power API (not yet implemented)');
      case 'restart':
        throw new BadRequestException('Restart action requires provider-specific power API (not yet implemented)');
      default:
        throw new BadRequestException(`Unknown action: ${dto.action}`);
    }
  }

  async findOne(instanceId: string): Promise<VpsResponseDto> {
    const instance = await this.repo.findOne({ where: { id: instanceId } });
    if (!instance) throw new NotFoundException('VPS instance not found');
    return this.toDto(instance);
  }

  async listByWorkspace(workspaceId: string): Promise<VpsResponseDto[]> {
    const items = await this.repo.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
    return items.map((i) => this.toDto(i));
  }

  private loadCloudInit(): string {
    try {
      const filePath = path.join(__dirname, 'bootstrap', 'cloud-init.yaml');
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      this.logger.warn('cloud-init.yaml not found, provisioning without user_data');
      return '';
    }
  }

  private toDto(i: VpsInstance): VpsResponseDto {
    return {
      id: i.id,
      workspaceId: i.workspaceId,
      provider: i.provider,
      providerInstanceId: i.providerInstanceId,
      region: i.region,
      size: i.size,
      ipAddress: i.ipAddress,
      status: i.status,
      costPerHour: i.costPerHour,
      totalCost: i.totalCost,
      metadata: i.metadata,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    };
  }
}
