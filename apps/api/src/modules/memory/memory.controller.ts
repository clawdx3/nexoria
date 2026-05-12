import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { MemoryService } from './memory.service';
import { CreateMemoryDto, MemoryResponseDto, SemanticSearchDto } from './dto/create-memory.dto';
import { EmbeddingService } from '../agent-runtime/embedding/embedding.service';
import { ProAgentOrJwtGuard } from '../../common/guards/pro-agent-or-jwt.guard';
import { AuthenticatedRequest } from '../../shared/interfaces/authenticated-request.interface';

@ApiTags('Memory')
@ApiBearerAuth()
@UseGuards(ProAgentOrJwtGuard)
@Controller('workspaces/:workspaceId/memory')
export class MemoryController {
  constructor(
    private readonly service: MemoryService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  @Get()
  @ApiResponse({ status: 200, type: [MemoryResponseDto] })
  findCurrentUserMemories(
    @Param('workspaceId') wsId: string,
    @Query('userId') userId: string | undefined,
    @Query('tier') tier: string | undefined,
    @Query('sessionId') sessionId: string | undefined,
    @Query('limit') limit: string | undefined,
    @Request() req: AuthenticatedRequest,
  ): Promise<MemoryResponseDto[]> {
    const effectiveUserId = userId ?? req.user.id;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const safeLimit = parsedLimit && !isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;
    const opts = {
      tier,
      sessionId,
      limit: safeLimit,
    };
    return this.service.findByWorkspaceUser(wsId, effectiveUserId, opts);
  }

  @Get('user/:userId')
  @ApiResponse({ status: 200, type: [MemoryResponseDto] })
  findByUser(@Param('workspaceId') wsId: string, @Param('userId') userId: string): Promise<MemoryResponseDto[]> {
    return this.service.findByUser(userId, wsId);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: MemoryResponseDto })
  findOne(@Param('id') id: string): Promise<MemoryResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 201, type: MemoryResponseDto })
  async create(
    @Param('workspaceId') wsId: string,
    @Body() dto: CreateMemoryDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<MemoryResponseDto> {
    const effectiveUserId = dto.userId ?? req.user?.id ?? 'pro-agent';
    const effectiveDto = { ...dto, userId: effectiveUserId };
    let embedding: number[] | undefined;
    if (effectiveDto.tier === 'long_term' && this.embeddingService.isReady()) {
      try {
        embedding = await this.embeddingService.embed(effectiveDto.content);
      } catch {
        // silently fall back
      }
    }
    return this.service.create(wsId, effectiveDto, { embedding });
  }

  @Post(':id/review')
  @ApiResponse({ status: 200, type: MemoryResponseDto })
  async review(
    @Param('id') id: string,
    @Body() dto: { action?: 'approve' | 'reject' | 'edit'; positive?: boolean },
  ): Promise<MemoryResponseDto> {
    const positive = typeof dto.positive === 'boolean' ? dto.positive : dto.action !== 'reject';
    await this.service.recordUse(id, positive);
    return this.service.findOne(id);
  }

  @Post('search')
  @ApiResponse({ status: 200, type: [MemoryResponseDto] })
  async semanticSearch(@Param('workspaceId') wsId: string, @Body() dto: SemanticSearchDto): Promise<MemoryResponseDto[]> {
    const embedding = await this.embeddingService.embed(dto.query);
    return this.service.semanticSearch(wsId, embedding, dto.limit ?? 10);
  }
}
