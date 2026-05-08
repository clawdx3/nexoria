import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { AttachmentScope, AttachmentSource, AttachmentVisibility } from '../../../database/entities/attachment.entity';

const scopes = ['chat', 'tasks', 'approvals', 'runtime-jobs', 'drafts', 'general'] as const;
const sources = ['user_upload', 'agent_upload', 'runtime', 'reference'] as const;
const visibilities = ['workspace', 'private'] as const;

export class CreateAttachmentUploadUrlDto {
  @ApiProperty()
  @IsString()
  filename: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  mimeType: string;

  @ApiProperty({ example: 102400 })
  @IsInt()
  @Min(1)
  @Max(25 * 1024 * 1024)
  sizeBytes: number;

  @ApiPropertyOptional({ enum: scopes })
  @IsOptional()
  @IsEnum(scopes)
  scope?: AttachmentScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scopeId?: string;

  @ApiPropertyOptional({ enum: sources })
  @IsOptional()
  @IsEnum(sources)
  source?: AttachmentSource;

  @ApiPropertyOptional({ enum: visibilities })
  @IsOptional()
  @IsEnum(visibilities)
  visibility?: AttachmentVisibility;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  runtimeChatSessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  runtimeChatMessageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  runtimeJobId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  approvalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  draftId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CompleteAttachmentUploadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checksumSha256?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UploadAttachmentBytesDto extends CreateAttachmentUploadUrlDto {
  @ApiProperty({ description: 'Base64 encoded file bytes.' })
  @IsString()
  contentBase64: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  createdByAgentProfileId?: string;
}

export class CreateAttachmentReferenceDto {
  @ApiProperty()
  @IsUUID()
  attachmentId: string;

  @ApiPropertyOptional({ enum: scopes })
  @IsOptional()
  @IsEnum(scopes)
  scope?: AttachmentScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scopeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  runtimeChatSessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  runtimeChatMessageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  runtimeJobId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  approvalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  draftId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class AttachmentListQueryDto {
  @IsOptional()
  @IsEnum(scopes)
  scope?: AttachmentScope;

  @IsOptional()
  @IsString()
  scopeId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsUUID()
  runtimeChatSessionId?: string;

  @IsOptional()
  @IsUUID()
  runtimeChatMessageId?: string;

  @IsOptional()
  @IsUUID()
  runtimeJobId?: string;

  @IsOptional()
  @IsUUID()
  draftId?: string;

  @IsOptional()
  @IsString()
  createdByAgentProfileId?: string;

  @IsOptional()
  @IsUUID()
  uploadedByUserId?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  source?: AttachmentSource;

  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({ default: 100, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class LinkAttachmentsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  attachmentIds: string[];
}
