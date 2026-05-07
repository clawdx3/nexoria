import { Controller, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AgentExecutorService } from './executor/agent-executor.service';
import { AgentProfilesService } from '../agent-profiles/agent-profiles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AgentContext } from '../../shared/interfaces/agent.interfaces';
import { IsString, IsOptional, IsUUID, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class RunAgentDto {
  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  autonomyLevel?: number;
}

@ApiTags('Agent Runtime')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/agent-runtime')
export class AgentRuntimeController {
  constructor(
    private readonly executor: AgentExecutorService,
    private readonly profiles: AgentProfilesService,
  ) {}

  @Post('run/:profileId')
  @ApiResponse({ status: 200, description: 'Agent execution result' })
  async run(
    @Param('workspaceId') wsId: string,
    @Param('profileId') profileId: string,
    @Body() dto: RunAgentDto,
    @Request() req,
  ) {
    const profile = await this.profiles.findOne(profileId);
    const ctx: AgentContext = {
      workspaceId: wsId,
      triggeredByUserId: req.user.id,
      userRole: 'member',
      projectId: dto.projectId,
      autonomyLevel: dto.autonomyLevel ?? profile.defaultAutonomyLevel,
      agentProfile: {
        id: profile.id,
        name: profile.name,
        systemPrompt: profile.systemPrompt,
        modelProvider: profile.modelProvider,
        modelName: profile.modelName,
        modelConfig: profile.modelConfig ?? {},
        enabledTools: profile.enabledTools,
        role: profile.role,
      },
    };
    return this.executor.run(ctx, dto.message);
  }
}
