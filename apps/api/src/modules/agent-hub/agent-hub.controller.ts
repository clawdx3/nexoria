import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AgentHubService } from './agent-hub.service';
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
  getTasks(): any[] {
    return this.service.getTasks();
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
