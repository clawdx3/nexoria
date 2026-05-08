import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { SocialPostDraftStatus, SocialPostPlatform } from '../../../database/entities/social-post-draft.entity';

export class CreateSocialPostDraftDto {
  @ApiPropertyOptional({ enum: ['facebook', 'instagram', 'linkedin', 'x', 'generic'], default: 'facebook' })
  @IsOptional()
  @IsEnum(['facebook', 'instagram', 'linkedin', 'x', 'generic'])
  platform?: SocialPostPlatform;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiProperty()
  @IsString()
  copy: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaBrief?: string;

  @ApiPropertyOptional({ enum: ['draft', 'review', 'approved', 'scheduled', 'published', 'rejected'], default: 'draft' })
  @IsOptional()
  @IsEnum(['draft', 'review', 'approved', 'scheduled', 'published', 'rejected'])
  status?: SocialPostDraftStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledFor?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional({ description: 'When true, also creates a Nexoria review task and links it to the draft.' })
  @IsOptional()
  @IsBoolean()
  createReviewTask?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateSocialPostDraftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  copy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaBrief?: string;

  @ApiPropertyOptional({ enum: ['draft', 'review', 'approved', 'scheduled', 'published', 'rejected'] })
  @IsOptional()
  @IsEnum(['draft', 'review', 'approved', 'scheduled', 'published', 'rejected'])
  status?: SocialPostDraftStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledFor?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class SocialPostDraftResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty()
  platform: SocialPostPlatform;

  @ApiProperty()
  title: string;

  @ApiProperty()
  topic: string | null;

  @ApiProperty()
  copy: string;

  @ApiProperty()
  mediaBrief: string | null;

  @ApiProperty()
  status: SocialPostDraftStatus;

  @ApiProperty()
  scheduledFor: Date | null;

  @ApiProperty()
  taskId: string | null;

  @ApiProperty()
  metadata: Record<string, any>;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
