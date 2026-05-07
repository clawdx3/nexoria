import { IsString, IsOptional, IsEnum, IsUUID, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMissionDto {
  @ApiProperty({ example: 'Generate weekly posts' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  context?: Record<string, any>;
}

export class UpdateMissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['queued', 'running', 'paused', 'completed', 'failed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['queued', 'running', 'paused', 'completed', 'failed', 'cancelled'])
  status?: string;
}

export class MissionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}
