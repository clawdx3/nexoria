import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AgentProfilesService } from './agent-profiles.service';
import { CreateAgentProfileDto, UpdateAgentProfileDto, AgentProfileResponseDto } from './dto/create-agent-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Agent Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/agent-profiles')
export class AgentProfilesController {
  constructor(private readonly service: AgentProfilesService) {}

  @Get()
  @ApiResponse({ status: 200, type: [AgentProfileResponseDto] })
  findByWorkspace(@Param('workspaceId') wsId: string): Promise<AgentProfileResponseDto[]> {
    return this.service.findByWorkspace(wsId);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: AgentProfileResponseDto })
  findOne(@Param('id') id: string): Promise<AgentProfileResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 201, type: AgentProfileResponseDto })
  create(@Param('workspaceId') wsId: string, @Body() dto: CreateAgentProfileDto): Promise<AgentProfileResponseDto> {
    return this.service.create(wsId, dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: AgentProfileResponseDto })
  update(@Param('workspaceId') wsId: string, @Param('id') id: string, @Body() dto: UpdateAgentProfileDto): Promise<AgentProfileResponseDto> {
    return this.service.update(id, dto, wsId);
  }

  @Delete(':id')
  @ApiResponse({ status: 204 })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
