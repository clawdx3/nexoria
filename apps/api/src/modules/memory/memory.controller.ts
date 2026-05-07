import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { MemoryService } from './memory.service';
import { CreateMemoryDto, MemoryResponseDto, SemanticSearchDto } from './dto/create-memory.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Memory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/memory')
export class MemoryController {
  constructor(private readonly service: MemoryService) {}

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
  create(@Param('workspaceId') wsId: string, @Body() dto: CreateMemoryDto): Promise<MemoryResponseDto> {
    return this.service.create(wsId, dto);
  }

  @Post('search')
  @ApiResponse({ status: 200, type: [MemoryResponseDto] })
  async semanticSearch(@Param('workspaceId') wsId: string, @Body() dto: SemanticSearchDto): Promise<MemoryResponseDto[]> {
    // In production, convert query to embedding via embedding model
    // For now, return empty or implement a fallback
    const mockEmbedding = Array(1536).fill(0).map(() => Math.random());
    return this.service.semanticSearch(wsId, dto, mockEmbedding);
  }
}
