import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, Subject } from 'rxjs';
import { Task, TaskStatus, TaskPriority } from '../../database/entities/task.entity';
import { CreateTaskDto, UpdateTaskDto, TaskResponseDto } from './dto/create-task.dto';

type TaskEvent = { type: 'task.created' | 'task.updated' | 'task.deleted'; workspaceId: string; task?: TaskResponseDto; taskId?: string };

@Injectable()
export class TasksService {
  private readonly events = new Map<string, Subject<TaskEvent>>();

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
    const dtoOut = this.toDto(saved);
    this.emit(workspaceId, { type: 'task.created', workspaceId, task: dtoOut });
    return dtoOut;
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
    const updated = await this.findOne(id);
    this.emit(updated.workspaceId, { type: 'task.updated', workspaceId: updated.workspaceId, task: updated });
    return updated;
  }

  async remove(id: string): Promise<void> {
    const task = await this.repo.findOne({ where: { id } });
    await this.repo.delete(id);
    if (task) this.emit(task.workspaceId, { type: 'task.deleted', workspaceId: task.workspaceId, taskId: id });
  }

  streamWorkspaceEvents(workspaceId: string): Observable<TaskEvent> {
    return this.subjectFor(workspaceId).asObservable();
  }

  private subjectFor(workspaceId: string): Subject<TaskEvent> {
    let subject = this.events.get(workspaceId);
    if (!subject) {
      subject = new Subject<TaskEvent>();
      this.events.set(workspaceId, subject);
    }
    return subject;
  }

  private emit(workspaceId: string, event: TaskEvent): void {
    this.subjectFor(workspaceId).next(event);
  }

  private toDto(task: Task): TaskResponseDto {
    return {
      id: task.id,
      workspaceId: task.workspaceId,
      projectId: task.projectId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignedToId: task.assignedToId,
      dueDate: task.dueDate,
      tags: task.tags ?? [],
      metadata: task.metadata ?? {},
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
