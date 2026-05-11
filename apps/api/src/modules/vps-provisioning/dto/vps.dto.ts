import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVpsDto {
  @ApiProperty({ enum: ['hetzner', 'digitalocean'], example: 'hetzner' })
  @IsEnum(['hetzner', 'digitalocean'])
  provider: 'hetzner' | 'digitalocean';

  @ApiProperty({ example: 'fsn1' })
  @IsString()
  region: string;

  @ApiProperty({ example: 'cx21' })
  @IsString()
  size: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  workspaceId?: string;
}

export class VpsActionDto {
  @ApiProperty({ enum: ['start', 'stop', 'restart', 'destroy'] })
  @IsEnum(['start', 'stop', 'restart', 'destroy'])
  action: 'start' | 'stop' | 'restart' | 'destroy';
}

export class VpsResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  workspaceId: string;

  @ApiProperty()
  provider: string;

  @ApiProperty()
  providerInstanceId: string;

  @ApiProperty()
  region: string;

  @ApiProperty()
  size: string;

  @ApiProperty()
  ipAddress: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  costPerHour: number;

  @ApiProperty()
  totalCost: number;

  @ApiProperty()
  metadata: Record<string, any> | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
