import { IsString, IsOptional, IsObject, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Main workspace for Acme' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class UpdateWorkspaceDto {
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
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

export class WorkspaceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  logoUrl: string;

  @ApiProperty()
  ownerId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class AddMemberDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ enum: ['owner', 'admin', 'member', 'viewer'] })
  @IsString()
  role: string;
}

export class WorkspaceMemberResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  joinedAt: Date;
}
