import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { TasksService } from './tasks.service';
import { CreateTaskCommentDto, CreateTaskDto, UpdateTaskDto, TaskResponseDto } from './dto/create-task.dto';
import { ProAgentOrJwtGuard } from '../../common/guards/pro-agent-or-jwt.guard';
import { AuthenticatedRequest } from '../../shared/interfaces/authenticated-request.interface';
import { ManagedRuntimeService } from '../managed-runtime/managed-runtime.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(ProAgentOrJwtGuard)
@Controller('workspaces/:workspaceId/tasks')
export class TasksController {
  constructor(private readonly service: TasksService, private readonly runtime: ManagedRuntimeService) {}

  @Get()
  @ApiResponse({ status: 200, type: [TaskResponseDto] })
  findByWorkspace(@Param('workspaceId') wsId: string): Promise<TaskResponseDto[]> {
    return this.service.findByWorkspace(wsId);
  }

  @Get('events')
  @ApiResponse({ status: 200 })
  events(@Param('workspaceId') wsId: string, @Res() res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    res.write(': connected\n\n');
    const subscription = this.service.streamWorkspaceEvents(wsId).subscribe((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25000);
    res.on('close', () => {
      clearInterval(heartbeat);
      subscription.unsubscribe();
    });
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: TaskResponseDto })
  findOne(@Param('workspaceId') wsId: string, @Param('id') id: string): Promise<TaskResponseDto> {
    return this.service.findOne(id, wsId);
  }

  @Get(':id/comments')
  @ApiResponse({ status: 200 })
  comments(@Param('workspaceId') wsId: string, @Param('id') id: string): Promise<any[]> {
    return this.service.findComments(wsId, id);
  }

  @Post(':id/comments')
  @ApiResponse({ status: 201 })
  createComment(@Param('workspaceId') wsId: string, @Param('id') id: string, @Body() dto: CreateTaskCommentDto, @Request() req: AuthenticatedRequest): Promise<any> {
    return this.service.createComment(wsId, id, req.user.id, dto);
  }

  @Post(':id/chat/sessions')
  @ApiResponse({ status: 201 })
  createTaskChatSession(@Param('workspaceId') wsId: string, @Param('id') id: string, @Request() req: AuthenticatedRequest): Promise<any> {
    return this.runtime.createTaskChatSession(wsId, req.user.id, id);
  }

  @Post()
  @ApiResponse({ status: 201, type: TaskResponseDto })
  create(@Param('workspaceId') wsId: string, @Body() dto: CreateTaskDto): Promise<TaskResponseDto> {
    return this.service.create(wsId, dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: TaskResponseDto })
  update(@Param('workspaceId') wsId: string, @Param('id') id: string, @Body() dto: UpdateTaskDto): Promise<TaskResponseDto> {
    return this.service.update(id, wsId, dto);
  }

  @Delete(':id')
  @ApiResponse({ status: 204 })
  remove(@Param('workspaceId') wsId: string, @Param('id') id: string): Promise<void> {
    return this.service.remove(id, wsId);
  }
}
