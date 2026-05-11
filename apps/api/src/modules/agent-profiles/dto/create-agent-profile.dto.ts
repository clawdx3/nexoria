import { IsString, IsOptional, IsObject, IsArray, IsInt, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentRole, ModelProvider, RuntimeMode, PlanTier } from '../../../database/entities/agent-profile.entity';

export class CreateAgentProfileDto {
  @ApiProperty({ example: 'Social Media Agent' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Handles all social media drafts' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'You are a social media expert...' })
  @IsString()
  systemPrompt: string;

  @ApiProperty({ enum: ['openai', 'anthropic', 'openrouter', 'ollama', 'custom'] })
  @IsEnum(['openai', 'anthropic', 'openrouter', 'ollama', 'custom'])
  modelProvider: ModelProvider;

  @ApiProperty({ example: 'gpt-4o' })
  @IsString()
  modelName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  modelConfig?: Record<string, any>;

  @ApiPropertyOptional({ example: ['create_fb_draft', 'create_ig_draft'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledTools?: string[];

  @ApiPropertyOptional({ enum: ['orchestrator', 'specialist'], default: 'specialist' })
  @IsOptional()
  @IsEnum(['orchestrator', 'specialist'])
  role?: AgentRole;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  defaultAutonomyLevel?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ enum: ['native_saas', 'native_pro'], default: 'native_saas' })
  @IsOptional()
  @IsEnum(['native_saas', 'native_pro'])
  runtimeMode?: RuntimeMode;

  @ApiPropertyOptional({ enum: ['economy', 'pro', 'enterprise'], default: 'economy' })
  @IsOptional()
  @IsEnum(['economy', 'pro', 'enterprise'])
  planTier?: PlanTier;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  remoteConfig?: Record<string, any>;
}

export class UpdateAgentProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['openai', 'anthropic', 'openrouter', 'ollama', 'custom'])
  modelProvider?: ModelProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modelName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  modelConfig?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledTools?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  defaultAutonomyLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ enum: ['native_saas', 'native_pro'] })
  @IsOptional()
  @IsEnum(['native_saas', 'native_pro'])
  runtimeMode?: RuntimeMode;

  @ApiPropertyOptional({ enum: ['economy', 'pro', 'enterprise'] })
  @IsOptional()
  @IsEnum(['economy', 'pro', 'enterprise'])
  planTier?: PlanTier;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  remoteConfig?: Record<string, any>;
}

export class AgentProfileResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workspaceId: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  systemPrompt: string;

  @ApiProperty()
  modelProvider: string;

  @ApiProperty()
  modelName: string;

  @ApiProperty()
  modelConfig: Record<string, any> | null;

  @ApiProperty()
  enabledTools: string[];

  @ApiProperty()
  role: string;

  @ApiProperty()
  defaultAutonomyLevel: number;

  @ApiProperty()
  isBuiltIn: boolean;

  @ApiProperty()
  isEnabled: boolean;

  @ApiProperty()
  runtimeMode: string;

  @ApiProperty()
  planTier: string;

  @ApiProperty()
  remoteConfig: Record<string, any>;

  @ApiProperty()
  createdAt: Date;
}
