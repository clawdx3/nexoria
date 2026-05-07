import { IsString, IsOptional, IsEnum, IsUUID, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAuditLogDto {
  @ApiProperty()
  @IsUUID()
  actorId: string;

  @ApiProperty({ enum: ['create', 'update', 'delete', 'login', 'logout', 'agent_run', 'tool_call', 'approval', 'integration_sync', 'other'] })
  @IsEnum(['create', 'update', 'delete', 'login', 'logout', 'agent_run', 'tool_call', 'approval', 'integration_sync', 'other'])
  action: string;

  @ApiProperty()
  @IsString()
  entityType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  before?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  after?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class AuditLogResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  actorId: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  entityType: string;

  @ApiProperty()
  entityId: string;

  @ApiProperty()
  createdAt: Date;
}
