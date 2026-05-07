import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { CreateIntegrationDto, UpdateIntegrationDto, IntegrationResponseDto } from './dto/create-integration.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/integrations')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get()
  @ApiResponse({ status: 200, type: [IntegrationResponseDto] })
  findByWorkspace(@Param('workspaceId') wsId: string): Promise<IntegrationResponseDto[]> {
    return this.service.findByWorkspace(wsId);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: IntegrationResponseDto })
  findOne(@Param('id') id: string): Promise<IntegrationResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 201, type: IntegrationResponseDto })
  create(@Param('workspaceId') wsId: string, @Body() dto: CreateIntegrationDto): Promise<IntegrationResponseDto> {
    return this.service.create(wsId, dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: IntegrationResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateIntegrationDto): Promise<IntegrationResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiResponse({ status: 204 })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
