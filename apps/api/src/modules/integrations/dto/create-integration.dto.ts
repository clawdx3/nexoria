import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIntegrationDto {
  @ApiProperty({ enum: ['facebook', 'instagram', 'shopify', 'woocommerce', 'mailchimp', 'stripe', 'custom'] })
  @IsEnum(['facebook', 'instagram', 'shopify', 'woocommerce', 'mailchimp', 'stripe', 'custom'])
  type: string;

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
  status?: string;

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
  lastSyncedAt: Date;

  @ApiProperty()
  createdAt: Date;
}
