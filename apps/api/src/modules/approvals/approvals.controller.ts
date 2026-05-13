import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalDto, SubmitDecisionDto, ApprovalResponseDto } from './dto/create-approval.dto';
import { ProAgentOrJwtGuard } from '../../common/guards/pro-agent-or-jwt.guard';
import { AuthenticatedRequest } from '../../shared/interfaces/authenticated-request.interface';

@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(ProAgentOrJwtGuard)
@Controller('workspaces/:workspaceId/approvals')
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  @Get()
  @ApiResponse({ status: 200, type: [ApprovalResponseDto] })
  findByWorkspace(@Param('workspaceId') wsId: string): Promise<ApprovalResponseDto[]> {
    return this.service.findByWorkspace(wsId);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: ApprovalResponseDto })
  findOne(@Param('id') id: string): Promise<ApprovalResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 201, type: ApprovalResponseDto })
  create(@Param('workspaceId') wsId: string, @Body() dto: CreateApprovalDto): Promise<ApprovalResponseDto> {
    return this.service.create(wsId, dto);
  }

  @Post(':id/decisions')
  @ApiResponse({ status: 200, type: ApprovalResponseDto })
  submitDecision(@Param('id') id: string, @Body() dto: SubmitDecisionDto, @Request() req: AuthenticatedRequest): Promise<ApprovalResponseDto> {
    return this.service.submitDecision(id, req.user.id, dto);
  }
}
