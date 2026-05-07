import { IsString, IsOptional, IsEnum, IsUUID, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApprovalDto {
  @ApiProperty({ enum: ['draft', 'task', 'autonomy_action', 'spend'] })
  @IsEnum(['draft', 'task', 'autonomy_action', 'spend'])
  type: string;

  @ApiProperty({ example: 'Approve Facebook post draft' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  missionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  draftId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SubmitDecisionDto {
  @ApiProperty({ enum: ['approve', 'reject', 'request_changes', 'escalate'] })
  @IsEnum(['approve', 'reject', 'request_changes', 'escalate'])
  outcome: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ApprovalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  taskId: string;

  @ApiProperty()
  missionId: string;

  @ApiProperty()
  draftId: string;

  @ApiProperty()
  metadata: Record<string, any>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
