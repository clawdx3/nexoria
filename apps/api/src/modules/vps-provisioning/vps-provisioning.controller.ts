import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { VpsProvisioningService } from './vps-provisioning.service';
import { CreateVpsDto, VpsActionDto, VpsResponseDto } from './dto/vps.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('VPS Provisioning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/vps')
export class VpsProvisioningController {
  constructor(private readonly service: VpsProvisioningService) {}

  @Get()
  @ApiResponse({ status: 200, type: [VpsResponseDto] })
  listByWorkspace(@Param('workspaceId') wsId: string): Promise<VpsResponseDto[]> {
    return this.service.listByWorkspace(wsId);
  }

  @Post()
  @ApiResponse({ status: 201, type: VpsResponseDto })
  provision(
    @Param('workspaceId') wsId: string,
    @Body() dto: CreateVpsDto,
  ): Promise<VpsResponseDto> {
    return this.service.provision(wsId, dto);
  }

  @Get(':vpsId')
  @ApiResponse({ status: 200, type: VpsResponseDto })
  findOne(@Param('vpsId') vpsId: string): Promise<VpsResponseDto> {
    return this.service.getStatus(vpsId);
  }

  @Post(':vpsId/actions')
  @ApiResponse({ status: 200, type: VpsResponseDto })
  performAction(
    @Param('vpsId') vpsId: string,
    @Body() dto: VpsActionDto,
  ): Promise<VpsResponseDto> {
    return this.service.performAction(vpsId, dto);
  }
}
