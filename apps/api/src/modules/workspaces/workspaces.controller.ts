import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto, WorkspaceResponseDto, WorkspaceMemberResponseDto, AddMemberDto } from './dto/create-workspace.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Workspaces')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly service: WorkspacesService) {}

  @Get()
  @ApiResponse({ status: 200, type: [WorkspaceResponseDto] })
  findByUser(@Request() req): Promise<WorkspaceResponseDto[]> {
    return this.service.findByUser(req.user.id);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: WorkspaceResponseDto })
  findOne(@Param('id') id: string): Promise<WorkspaceResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 201, type: WorkspaceResponseDto })
  create(@Body() dto: CreateWorkspaceDto, @Request() req): Promise<WorkspaceResponseDto> {
    return this.service.create(req.user.id, dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: WorkspaceResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateWorkspaceDto): Promise<WorkspaceResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiResponse({ status: 204 })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Post(':id/members')
  @ApiResponse({ status: 201 })
  addMember(@Param('id') id: string, @Body() dto: AddMemberDto, @Request() req) {
    return this.service.addMember(id, dto, req.user.id);
  }

  @Get(':id/members')
  @ApiResponse({ status: 200, type: [WorkspaceMemberResponseDto] })
  listMembers(@Param('id') id: string): Promise<WorkspaceMemberResponseDto[]> {
    return this.service.listMembers(id);
  }

  @Delete(':id/members/:userId')
  @ApiResponse({ status: 204 })
  removeMember(@Param('id') wsId: string, @Param('userId') userId: string): Promise<void> {
    return this.service.removeMember(wsId, userId);
  }
}
