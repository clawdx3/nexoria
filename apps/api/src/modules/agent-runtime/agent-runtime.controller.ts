import { Controller, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AgentExecutorService } from './executor/agent-executor.service';
import { AgentProfilesService } from '../agent-profiles/agent-profiles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AgentContext } from '../../shared/interfaces/agent.interfaces';
import { AuthenticatedRequest } from '../../shared/interfaces/authenticated-request.interface';
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
    @Request() req: AuthenticatedRequest,
  ) {
    const profile = profileId === 'orchestrator'
      ? {
          id: 'orchestrator',
          name: 'Operations Orchestrator',
          systemPrompt:
            'Coordinate workspace operations. Give concise, practical answers and create or inspect work with tools when they are available.',
          modelProvider: process.env.DEFAULT_MODEL_PROVIDER || 'ollama',
          modelName: process.env.OLLAMA_MODEL || process.env.DEFAULT_MODEL_NAME || 'gpt-oss:120b',
          modelConfig: {},
          enabledTools: ['create_task', 'list_tasks'],
          role: 'orchestrator',
          defaultAutonomyLevel: 1,
        }
      : await this.profiles.findOne(profileId);
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
    const result = await this.executor.run(ctx, dto.message);
    return {
      status: result.success ? 'completed' : 'failed',
      message: result.finalOutput ?? result.error ?? 'Task dispatched.',
      result,
    };
  }
}
