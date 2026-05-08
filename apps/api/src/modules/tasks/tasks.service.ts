import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, Subject } from 'rxjs';
import { Task, TaskStatus, TaskPriority } from '../../database/entities/task.entity';
import { TaskComment } from '../../database/entities/task-comment.entity';
import { AttachmentsService } from '../attachments/attachments.service';
import { CreateTaskCommentDto, CreateTaskDto, TaskCommentResponseDto, UpdateTaskDto, TaskResponseDto } from './dto/create-task.dto';

type TaskEvent = { type: 'task.created' | 'task.updated' | 'task.deleted' | 'task.comment.created'; workspaceId: string; task?: TaskResponseDto; taskId?: string; comment?: TaskCommentResponseDto };

@Injectable()
export class TasksService {
  private readonly events = new Map<string, Subject<TaskEvent>>();

  constructor(
    @InjectRepository(Task) private readonly repo: Repository<Task>,
    @InjectRepository(TaskComment) private readonly comments: Repository<TaskComment>,
    private readonly attachments: AttachmentsService,
  ) {}

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

  async findOne(id: string, workspaceId?: string): Promise<TaskResponseDto> {
    const where: Record<string, any> = { id };
    if (workspaceId) where.workspaceId = workspaceId;
    const task = await this.repo.findOne({ where });
    if (!task) throw new NotFoundException('Task not found');
    return this.toDto(task);
  }

  async findByWorkspace(workspaceId: string): Promise<TaskResponseDto[]> {
    const tasks = await this.repo.find({ where: { workspaceId }, order: { createdAt: 'DESC' } });
    return tasks.map((t) => this.toDto(t));
  }

  async update(id: string, workspaceId: string, dto: UpdateTaskDto): Promise<TaskResponseDto> {
    const existing = await this.repo.findOne({ where: { id, workspaceId } });
    if (!existing) throw new NotFoundException('Task not found');
    await this.repo.update(id, dto);
    const updated = await this.findOne(id);
    this.emit(updated.workspaceId, { type: 'task.updated', workspaceId: updated.workspaceId, task: updated });
    return updated;
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const task = await this.repo.findOne({ where: { id, workspaceId } });
    if (!task) throw new NotFoundException('Task not found');
    await this.repo.delete(id);
    this.emit(task.workspaceId, { type: 'task.deleted', workspaceId: task.workspaceId, taskId: id });
  }

  async findComments(workspaceId: string, taskId: string): Promise<TaskCommentResponseDto[]> {
    await this.requireTask(workspaceId, taskId);
    const comments = await this.comments.find({ where: { workspaceId, taskId }, order: { createdAt: 'ASC' } });
    return comments.map((comment) => this.commentDto(comment));
  }

  async createComment(workspaceId: string, taskId: string, userId: string | null, dto: CreateTaskCommentDto): Promise<TaskCommentResponseDto> {
    await this.requireTask(workspaceId, taskId);
    const attachmentIds = dto.attachmentIds ?? [];
    if (attachmentIds.length) await this.attachments.getMany(workspaceId, attachmentIds);
    const saved = await this.comments.save(this.comments.create({
      workspaceId,
      taskId,
      authorUserId: userId,
      authorAgentProfileId: dto.authorAgentProfileId ?? null,
      body: dto.body,
      attachmentIds,
      metadata: dto.metadata ?? {},
    }));
    for (const attachmentId of attachmentIds) {
      await this.attachments.reference(workspaceId, { attachmentId, scope: 'tasks', scopeId: taskId, taskId, metadata: { linkedBy: 'task_comment', taskCommentId: saved.id } });
    }
    const out = this.commentDto(saved);
    this.emit(workspaceId, { type: 'task.comment.created', workspaceId, taskId, comment: out });
    return out;
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
    if (subject.closed) {
      subject = new Subject<TaskEvent>();
      this.events.set(workspaceId, subject);
    }
    return subject;
  }

  private emit(workspaceId: string, event: TaskEvent): void {
    this.subjectFor(workspaceId).next(event);
    this.cleanupEventStreams();
  }

  private cleanupEventStreams(): void {
    for (const [wsId, subject] of this.events) {
      if (subject.closed || subject.observers.length === 0) {
        subject.complete();
        this.events.delete(wsId);
      }
    }
  }

  private async requireTask(workspaceId: string, taskId: string): Promise<Task> {
    const task = await this.repo.findOne({ where: { id: taskId, workspaceId } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
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

  private commentDto(comment: TaskComment): TaskCommentResponseDto {
    return {
      id: comment.id,
      workspaceId: comment.workspaceId,
      taskId: comment.taskId,
      authorUserId: comment.authorUserId,
      authorAgentProfileId: comment.authorAgentProfileId,
      body: comment.body,
      attachmentIds: comment.attachmentIds ?? [],
      metadata: comment.metadata ?? {},
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}
