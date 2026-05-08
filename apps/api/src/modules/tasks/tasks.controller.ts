import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, TaskResponseDto } from './dto/create-task.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

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
  findOne(@Param('id') id: string): Promise<TaskResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 201, type: TaskResponseDto })
  create(@Param('workspaceId') wsId: string, @Body() dto: CreateTaskDto): Promise<TaskResponseDto> {
    return this.service.create(wsId, dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: TaskResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto): Promise<TaskResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiResponse({ status: 204 })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }
}
