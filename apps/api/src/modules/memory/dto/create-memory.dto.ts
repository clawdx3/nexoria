import { IsString, IsOptional, IsEnum, IsUUID, IsObject, IsNumber, IsDate, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateMemoryDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: ['profile', 'session', 'daily', 'long_term'] })
  @IsEnum(['profile', 'session', 'daily', 'long_term'])
  tier: string;

  @ApiProperty({ enum: ['fact', 'preference', 'avoidance', 'pattern', 'task_result', 'draft', 'conversation'] })
  @IsEnum(['fact', 'preference', 'avoidance', 'pattern', 'task_result', 'draft', 'conversation'])
  type: string;

  @ApiProperty({ example: 'User prefers formal tone in emails' })
  @IsString()
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ example: 1.0 })
  @IsOptional()
  @IsNumber()
  confidence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;
}

export class MemoryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  tier: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  confidence: number;

  @ApiProperty()
  positiveUses: number;

  @ApiProperty()
  negativeUses: number;

  @ApiProperty()
  createdAt: Date;
}

export class SemanticSearchDto {
  @ApiProperty({ example: 'formal tone preference' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  limit?: number;
}
