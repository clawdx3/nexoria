import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { CreateAuditLogDto, AuditLogResponseDto } from './dto/audit-log.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @ApiResponse({ status: 200, type: [AuditLogResponseDto] })
  findByWorkspace(@Param('workspaceId') wsId: string): Promise<AuditLogResponseDto[]> {
    return this.service.findByWorkspace(wsId);
  }

  @Post()
  @ApiResponse({ status: 201, type: AuditLogResponseDto })
  create(
    @Param('workspaceId') wsId: string,
    @Body() dto: CreateAuditLogDto,
    @Request() req,
  ): Promise<AuditLogResponseDto> {
    return this.service.log(wsId, { ...dto, actorId: req.user.id });
  }
}
