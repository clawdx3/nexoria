import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PlaybooksService } from './playbooks.service';
import { CreatePlaybookDto, UpdatePlaybookDto, PlaybookResponseDto } from './dto/create-playbook.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Playbooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/playbooks')
export class PlaybooksController {
  constructor(private readonly service: PlaybooksService) {}

  @Get()
  @ApiResponse({ status: 200, type: [PlaybookResponseDto] })
  findByWorkspace(@Param('workspaceId') wsId: string): Promise<PlaybookResponseDto[]> {
    return this.service.findByWorkspace(wsId);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: PlaybookResponseDto })
  findOne(@Param('id') id: string): Promise<PlaybookResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 201, type: PlaybookResponseDto })
  create(@Param('workspaceId') wsId: string, @Body() dto: CreatePlaybookDto): Promise<PlaybookResponseDto> {
    return this.service.create(wsId, dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: PlaybookResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdatePlaybookDto): Promise<PlaybookResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiResponse({ status: 204 })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
