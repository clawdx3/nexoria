import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus, TaskPriority } from '../../database/entities/task.entity';
import { CreateTaskDto, UpdateTaskDto, TaskResponseDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  constructor(@InjectRepository(Task) private readonly repo: Repository<Task>) {}

  async create(workspaceId: string, dto: CreateTaskDto): Promise<TaskResponseDto> {
    const task = this.repo.create({
      workspaceId,
      title: dto.title,
      description: dto.description,
      projectId: dto.projectId,
      status: (dto.status as TaskStatus) ?? 'pending',
      priority: (dto.priority as TaskPriority) ?? 'medium',
      assignedToId: dto.assignedToId,
      dueDate: dto.dueDate,
      tags: dto.tags ?? [],
      metadata: dto.metadata ?? {},
    });
    const saved = await this.repo.save(task);
    return this.toDto(saved);
  }

  async findOne(id: string): Promise<TaskResponseDto> {
    const task = await this.repo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    return this.toDto(task);
  }

  async findByWorkspace(workspaceId: string): Promise<TaskResponseDto[]> {
    const tasks = await this.repo.find({ where: { workspaceId }, order: { createdAt: 'DESC' } });
    return tasks.map((t) => this.toDto(t));
  }

  async update(id: string, dto: UpdateTaskDto): Promise<TaskResponseDto> {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private toDto(task: Task): TaskResponseDto {
    return {
      id: task.id,
      workspaceId: task.workspaceId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignedToId: task.assignedToId,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
    };
  }
}
