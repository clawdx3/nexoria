import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntegrationStatus, IntegrationType } from '../../../database/entities/integration.entity';

export class CreateIntegrationDto {
  @ApiProperty({ enum: ['facebook', 'instagram', 'gmail', 'mailerlite', 'shopify', 'woocommerce', 'mailchimp', 'stripe', 'custom'] })
  @IsEnum(['facebook', 'instagram', 'gmail', 'mailerlite', 'shopify', 'woocommerce', 'mailchimp', 'stripe', 'custom'])
  type: IntegrationType;

  @ApiProperty({ example: 'Facebook Page' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  credentials?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class UpdateIntegrationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(['connected', 'disconnected', 'error', 'refreshing'])
  status?: IntegrationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  credentials?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class IntegrationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  lastSyncedAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}
