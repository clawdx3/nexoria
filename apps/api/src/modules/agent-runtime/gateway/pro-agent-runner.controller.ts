import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import * as nacl from 'tweetnacl';
import { Repository } from 'typeorm';
import { RuntimeInstance } from '../../../database/entities/runtime-instance.entity';
import { ProAgentHttpGuard } from '../../../common/guards/pro-agent-http.guard';
import { RegisterRuntimeInstanceDto } from '../../managed-runtime/dto/managed-runtime.dto';

@ApiTags('Pro Agent Runner')
@Controller('runner/runtime')
export class ProAgentRunnerController {
  constructor(
    @InjectRepository(RuntimeInstance)
    private readonly instances: Repository<RuntimeInstance>,
  ) {}

  @Post('instances')
  @UseGuards(ProAgentHttpGuard)
  async registerInstance(@Body() dto: RegisterRuntimeInstanceDto): Promise<any> {
    if (!dto.instanceKey) throw new NotFoundException('instanceKey required');

    let instance = await this.instances.findOne({ where: { instanceKey: dto.instanceKey } });
    const patch = {
      workspaceId: dto.workspaceId ?? null,
      status: 'ready' as const,
      mode: dto.mode ?? 'pro-agent',
      version: dto.version,
      gatewayUrl: dto.gatewayUrl,
      lastHeartbeatAt: new Date(),
      metadata: { ...(dto.metadata ?? {}), ed25519PublicKey: dto.metadata?.ed25519PublicKey ?? instance?.metadata?.ed25519PublicKey },
    };
    if (instance) {
      await this.instances.update(instance.id, patch);
      instance = await this.instances.findOneOrFail({ where: { id: instance.id } });
    } else {
      instance = await this.instances.save(this.instances.create({ instanceKey: dto.instanceKey, ...patch }));
    }
    return {
      id: instance.id,
      instanceKey: instance.instanceKey,
      workspaceId: instance.workspaceId,
      status: instance.status,
      mode: instance.mode,
      metadata: instance.metadata ?? {},
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
    };
  }

  @Post('instances/:instanceKey/heartbeat')
  @UseGuards(ProAgentHttpGuard)
  async heartbeat(@Param('instanceKey') instanceKey: string, @Body() dto: { status?: string; metadata?: Record<string, any> }): Promise<any> {
    const instance = await this.instances.findOne({ where: { instanceKey } });
    if (!instance) throw new NotFoundException('Runtime instance not found');
    await this.instances.update(instance.id, {
      status: (dto.status as any) ?? 'ready',
      lastHeartbeatAt: new Date(),
      metadata: { ...(instance.metadata ?? {}), ...(dto.metadata ?? {}) },
    });
    const updated = await this.instances.findOneOrFail({ where: { id: instance.id } });
    return {
      id: updated.id,
      instanceKey: updated.instanceKey,
      workspaceId: updated.workspaceId,
      status: updated.status,
      mode: updated.mode,
      metadata: updated.metadata ?? {},
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
