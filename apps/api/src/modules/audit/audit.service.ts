import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../../database/entities/audit-log.entity';
import { CreateAuditLogDto, AuditLogResponseDto } from './dto/audit-log.dto';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async log(workspaceId: string | undefined, dto: CreateAuditLogDto): Promise<AuditLogResponseDto> {
    const entry = this.repo.create({
      workspaceId,
      actorId: dto.actorId,
      action: dto.action as AuditAction,
      entityType: dto.entityType,
      entityId: dto.entityId,
      before: dto.before ?? null,
      after: dto.after ?? null,
      reason: dto.reason,
      metadata: dto.metadata ?? null,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
    });
    const saved = await this.repo.save(entry);
    return this.toDto(saved);
  }

  async findByWorkspace(workspaceId: string, limit = 100): Promise<AuditLogResponseDto[]> {
    const items = await this.repo.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return items.map((i) => this.toDto(i));
  }

  private toDto(a: AuditLog): AuditLogResponseDto {
    return {
      id: a.id,
      actorId: a.actorId,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      createdAt: a.createdAt,
    };
  }
}
