import { IsString, IsOptional, IsArray, IsObject, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlaybookDto {
  @ApiProperty({ example: 'Weekly Social Blast' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: [{ step: 1, action: 'generate_draft', tool: 'create_fb_draft' }] })
  @IsArray()
  steps: Record<string, any>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  triggers?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}

export class UpdatePlaybookDto {
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
  @IsArray()
  steps?: Record<string, any>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PlaybookResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  steps: Record<string, any>[];

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;
}
