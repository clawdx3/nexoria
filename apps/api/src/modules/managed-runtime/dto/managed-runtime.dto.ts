import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { RuntimeJobStatus, RuntimeJobType } from '../../../database/entities/runtime-job.entity';

export class CreateRuntimeJobDto {
  @ApiProperty({ example: 'orchestrator' })
  @IsString()
  agentProfileId: string;

  @ApiPropertyOptional({ enum: ['create_file', 'research', 'browser_task', 'native_pro_chat', 'native_pro_task'] })
  @IsOptional()
  @IsEnum(['create_file', 'research', 'browser_task', 'native_pro_chat', 'native_pro_task'])
  type?: RuntimeJobType;

  @ApiProperty({ example: { prompt: 'Create a CSV with three lead follow-up tasks.' } })
  @IsObject()
  input: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  limits?: Record<string, any>;
}

export class RegisterRuntimeInstanceDto {
  @ApiProperty()
  @IsString()
  instanceKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @ApiPropertyOptional({ example: 'local-docker' })
  @IsOptional()
  @IsString()
  mode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gatewayUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class HeartbeatRuntimeInstanceDto {
  @ApiPropertyOptional({ enum: ['provisioning', 'ready', 'offline', 'error', 'paused', 'destroyed'] })
  @IsOptional()
  @IsEnum(['provisioning', 'ready', 'offline', 'error', 'paused', 'destroyed'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateRuntimeEventDto {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiPropertyOptional({ enum: ['debug', 'info', 'warn', 'error'] })
  @IsOptional()
  @IsEnum(['debug', 'info', 'warn', 'error'])
  level?: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CompleteRuntimeJobDto {
  @ApiProperty({ enum: ['completed', 'failed', 'rejected', 'cancelled'] })
  @IsEnum(['completed', 'failed', 'rejected', 'cancelled'])
  status: RuntimeJobStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  result?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error?: string;
}

export class DelegateToSpecialistDto {
  @ApiProperty({ description: 'Agent profile ID or name of the specialist' })
  @IsString()
  specialistId: string;

  @ApiProperty({ description: 'The task/prompt for the specialist' })
  @IsString()
  prompt: string;

  @ApiPropertyOptional({ description: 'Parent chat session ID for context' })
  @IsOptional()
  @IsString()
  parentSessionId?: string;
}

export class UploadArtifactDto {
  @ApiProperty()
  @IsString()
  filename: string;

  @ApiProperty({ example: 'text/csv' })
  @IsString()
  mimeType: string;

  @ApiProperty({ description: 'Base64 encoded file bytes.' })
  @IsString()
  contentBase64: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class RuntimeLimitsDto {
  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(3600)
  timeoutSeconds?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  maxOutputFiles?: number;

  @ApiPropertyOptional({ example: 10485760 })
  @IsOptional()
  @IsInt()
  @Min(1024)
  maxArtifactBytes?: number;

  @ApiPropertyOptional({ example: ['.txt', '.md', '.csv', '.json', '.html'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedExtensions?: string[];
}

export class CreateRuntimeChatSessionDto {
  @ApiPropertyOptional({ example: 'orchestrator' })
  @IsOptional()
  @IsString()
  agentProfileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SendRuntimeChatMessageDto {
  @ApiProperty({ example: 'Help me plan today outreach tasks.' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  attachmentIds?: string[];

  @ApiPropertyOptional({ enum: ['native_saas', 'native_pro'], description: 'Override agent runtime mode for this message' })
  @IsOptional()
  @IsEnum(['native_saas', 'native_pro'])
  runtimeMode?: 'native_saas' | 'native_pro';
}

export class UpdateChatSessionTitleDto {
  @ApiPropertyOptional({ example: 'Outreach planning' })
  @IsOptional()
  @IsString()
  title?: string;
}
