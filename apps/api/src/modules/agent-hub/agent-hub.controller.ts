import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AgentHubService, AgentTask } from './agent-hub.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Agent Hub')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agent-hub')
export class AgentHubController {
  constructor(private readonly service: AgentHubService) {}

  @Get('agents')
  @ApiResponse({ status: 200 })
  getAgents(): any[] {
    return this.service.getAgents();
  }

  @Get('tasks')
  @ApiResponse({ status: 200 })
  getTasks(): AgentTask[] {
    return this.service.getTasks();
  }

  @Get('tasks/:id')
  @ApiResponse({ status: 200 })
  getTask(@Param('id') id: string): AgentTask | null {
    return this.service.getTask(id);
  }

  @Post('tasks')
  @ApiResponse({ status: 201 })
  createTask(@Body() body: { type: string; payload: Record<string, any> }): AgentTask {
    return this.service.createTask(body.type, body.payload);
  }

  @Get('approvals')
  @ApiResponse({ status: 200 })
  getApprovals(): any[] {
    return this.service.getApprovals();
  }

  @Post('approvals/:id/decisions')
  @ApiResponse({ status: 200 })
  resolveApproval(
    @Param('id') id: string,
    @Body() body: { decision: 'approved' | 'rejected'; reason?: string },
  ): void {
    this.service.resolveApproval(id, body.decision, body.reason);
  }
}
