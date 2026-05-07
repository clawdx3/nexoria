import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { MissionsService } from './missions.service';
import { CreateMissionDto, UpdateMissionDto, MissionResponseDto } from './dto/create-mission.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Missions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/missions')
export class MissionsController {
  constructor(private readonly service: MissionsService) {}

  @Get()
  @ApiResponse({ status: 200, type: [MissionResponseDto] })
  findByWorkspace(@Param('workspaceId') wsId: string): Promise<MissionResponseDto[]> {
    return this.service.findByWorkspace(wsId);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: MissionResponseDto })
  findOne(@Param('id') id: string): Promise<MissionResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 201, type: MissionResponseDto })
  create(@Param('workspaceId') wsId: string, @Body() dto: CreateMissionDto): Promise<MissionResponseDto> {
    return this.service.create(wsId, dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: MissionResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateMissionDto): Promise<MissionResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiResponse({ status: 204 })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
