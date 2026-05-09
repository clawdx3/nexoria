import { Controller, Get, Post, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { MemoryService } from './memory.service';
import { CreateMemoryDto, MemoryResponseDto, SemanticSearchDto } from './dto/create-memory.dto';
import { EmbeddingService } from '../agent-runtime/embedding/embedding.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../shared/interfaces/authenticated-request.interface';

@ApiTags('Memory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/memory')
export class MemoryController {
  constructor(
    private readonly service: MemoryService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  @Get()
  @ApiResponse({ status: 200, type: [MemoryResponseDto] })
  findCurrentUserMemories(@Param('workspaceId') wsId: string, @Request() req: AuthenticatedRequest): Promise<MemoryResponseDto[]> {
    return this.service.findByWorkspaceUser(wsId, req.user.id);
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
  async create(@Param('workspaceId') wsId: string, @Body() dto: CreateMemoryDto): Promise<MemoryResponseDto> {
    let embedding: number[] | undefined;
    if (dto.tier === 'long_term' && this.embeddingService.isReady()) {
      try {
        embedding = await this.embeddingService.embed(dto.content);
      } catch {
        // silently fall back
      }
    }
    return this.service.create(wsId, dto, { embedding });
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
