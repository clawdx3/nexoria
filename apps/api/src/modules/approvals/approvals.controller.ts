import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalDto, SubmitDecisionDto, ApprovalResponseDto } from './dto/create-approval.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  submitDecision(@Param('id') id: string, @Body() dto: SubmitDecisionDto, @Request() req): Promise<ApprovalResponseDto> {
    return this.service.submitDecision(id, req.user.id, dto);
  }
}
