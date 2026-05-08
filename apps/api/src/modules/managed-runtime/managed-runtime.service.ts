import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as path from 'node:path';
import { Observable, Subject } from 'rxjs';
import { AgentProfilesService } from '../agent-profiles/agent-profiles.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { RuntimeInstance, RuntimeInstanceStatus } from '../../database/entities/runtime-instance.entity';
import { RuntimeJob, RuntimeJobStatus } from '../../database/entities/runtime-job.entity';
import { RuntimeEvent } from '../../database/entities/runtime-event.entity';
import { Artifact } from '../../database/entities/artifact.entity';
import { RuntimeChatSession } from '../../database/entities/runtime-chat-session.entity';
import { RuntimeChatMessage, RuntimeChatMessageRole } from '../../database/entities/runtime-chat-message.entity';
import { RuntimeChatCommand, RuntimeChatCommandStatus, RuntimeChatCommandType } from '../../database/entities/runtime-chat-command.entity';
import { Task } from '../../database/entities/task.entity';
import { TaskComment } from '../../database/entities/task-comment.entity';
import {
  CompleteRuntimeChatCommandDto,
  CompleteRuntimeJobDto,
  CreateRuntimeChatSessionDto,
  CreateRuntimeEventDto,
  CreateRuntimeJobDto,
  HeartbeatRuntimeInstanceDto,
  RegisterRuntimeInstanceDto,
  RuntimeChatRunnerEventDto,
  SendRuntimeChatMessageDto,
  UploadArtifactDto,
} from './dto/managed-runtime.dto';
import { BOOTSTRAP_VERSION, BOOTSTRAP_FILES, BOOTSTRAP_MANAGED_PATHS } from './bootstrap-templates';

const DEFAULT_LIMITS = {
  timeoutSeconds: 300,
  maxOutputFiles: 5,
  maxArtifactBytes: 10 * 1024 * 1024,
  allowedExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.txt', '.md', '.csv', '.json', '.html', '.docx', '.xlsx'],
};

const DELEGATION_CAPS = {
  maxPerParentSession: 5,
  maxPerWorkspace: 8,
};

@Injectable()
export class ManagedRuntimeService {
  private readonly chatStreams = new Map<string, Subject<any>>();

  constructor(
    @InjectRepository(RuntimeInstance) private readonly instances: Repository<RuntimeInstance>,
    @InjectRepository(RuntimeJob) private readonly jobs: Repository<RuntimeJob>,
    @InjectRepository(RuntimeEvent) private readonly events: Repository<RuntimeEvent>,
    @InjectRepository(Artifact) private readonly artifacts: Repository<Artifact>,
    @InjectRepository(RuntimeChatSession) private readonly chatSessions: Repository<RuntimeChatSession>,
    @InjectRepository(RuntimeChatMessage) private readonly chatMessages: Repository<RuntimeChatMessage>,
    @InjectRepository(RuntimeChatCommand) private readonly chatCommands: Repository<RuntimeChatCommand>,
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(TaskComment) private readonly taskComments: Repository<TaskComment>,
    private readonly agentProfiles: AgentProfilesService,
    private readonly attachments: AttachmentsService,
  ) {}

  async createJob(workspaceId: string, requestedByUserId: string | null, dto: CreateRuntimeJobDto): Promise<any> {
    await this.assertAgentAllowed(workspaceId, dto.agentProfileId);
    await this.assertDelegationCapacity(workspaceId, dto.input?.parentChatSessionId);
    const instance = await this.findReadyInstance(workspaceId);
    const job = this.jobs.create({
      workspaceId,
      requestedByUserId,
      instanceId: instance?.id ?? null,
      agentProfileId: dto.agentProfileId,
      type: dto.type ?? 'openclaw_task',
      status: 'queued',
      input: dto.input,
      limits: this.normalizeLimits(dto.limits),
      result: null,
    });
    const saved = await this.jobs.save(job);
    await this.addEvent(workspaceId, saved.id, saved.instanceId, 'job_queued', 'info', 'Runtime job queued.', {
      agentProfileId: saved.agentProfileId,
      type: saved.type,
    });
    return this.jobDto(saved);
  }

  async workspaceStatus(workspaceId: string): Promise<any> {
    const instance = await this.findReadyInstance(workspaceId);
    const recentJobs = await this.jobs.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    return {
      status: instance ? instance.status : 'offline',
      instance: instance ? this.instanceDto(instance) : null,
      recentJobs: recentJobs.map((job) => this.jobDto(job)),
    };
  }

  async listJobs(workspaceId: string): Promise<any[]> {
    const jobs = await this.jobs.find({ where: { workspaceId }, order: { createdAt: 'DESC' } });
    return jobs.map((job) => this.jobDto(job));
  }

  async getJob(workspaceId: string, jobId: string): Promise<any> {
    const job = await this.jobs.findOne({ where: { id: jobId, workspaceId } });
    if (!job) throw new NotFoundException('Runtime job not found');
    const events = await this.events.find({ where: { jobId }, order: { createdAt: 'ASC' } });
    const artifacts = await this.artifacts.find({ where: { jobId }, order: { createdAt: 'ASC' } });
    return {
      ...this.jobDto(job),
      events: events.map((event) => this.eventDto(event)),
      artifacts: artifacts.map((artifact) => this.artifactDto(artifact)),
    };
  }

  async createChatSession(workspaceId: string, userId: string, dto: CreateRuntimeChatSessionDto): Promise<any> {
    const agentProfileId = dto.agentProfileId || 'orchestrator';
    await this.assertAgentAllowed(workspaceId, agentProfileId);
    const instance = await this.findReadyInstance(workspaceId);
    const allowedAgentIds = await this.allowedAgentIds(workspaceId);
    const session = await this.chatSessions.save(this.chatSessions.create({
      workspaceId,
      userId,
      agentProfileId,
      instanceId: instance?.id ?? null,
      status: 'pending',
      metadata: dto.metadata ?? {},
    }));
    await this.enqueueChatCommand(session, 'start_session', {
      context: await this.buildRuntimeChatContext(workspaceId, userId, agentProfileId, allowedAgentIds, dto.metadata ?? {}, session.id),
      allowedAgentIds,
    });
    this.emitChat(session.id, { type: 'session_created', session: this.chatSessionDto(session) });
    return this.chatSessionDto(session);
  }

  async getChatSession(workspaceId: string, sessionId: string): Promise<any> {
    const session = await this.chatSessions.findOne({ where: { id: sessionId, workspaceId } });
    if (!session) throw new NotFoundException('Runtime chat session not found');
    return this.chatSessionDto(session);
  }

  async listChatMessages(workspaceId: string, sessionId: string): Promise<any[]> {
    await this.requireChatSession(workspaceId, sessionId);
    const messages = await this.chatMessages.find({
      where: { workspaceId, sessionId },
      order: { createdAt: 'ASC' },
    });
    return messages.map((message) => this.chatMessageDto(message));
  }

  async sendChatMessage(workspaceId: string, userId: string, sessionId: string, dto: SendRuntimeChatMessageDto): Promise<any> {
    const session = await this.requireChatSession(workspaceId, sessionId);
    await this.assertAgentAllowed(workspaceId, session.agentProfileId);
    if (session.status === 'closed') throw new BadRequestException('Runtime chat session is closed');
    if (this.containsManagedPolicyViolation(dto.content)) {
      const system = await this.saveChatMessage(workspaceId, sessionId, 'system', 'Creating or modifying agents requires admin approval in managed runtime v1.', 'completed', {
        policyViolation: true,
      });
      this.emitChat(sessionId, { type: 'policy_violation', message: this.chatMessageDto(system) });
      return { message: this.chatMessageDto(system) };
    }

    const attachmentIds = dto.attachmentIds ?? [];
    if (attachmentIds.length) await this.attachments.getMany(workspaceId, attachmentIds);
    const message = await this.saveChatMessage(workspaceId, sessionId, 'user', dto.content, 'completed', { userId, attachmentIds });
    const linkedAttachments = attachmentIds.length
      ? await this.attachments.linkToChatMessage(workspaceId, attachmentIds, message.id, sessionId)
      : [];
    await this.chatSessions.update(sessionId, { lastMessageAt: new Date() });
    const isFirstMessage = !session.openclawSessionKey;
    const context = isFirstMessage
      ? await this.buildRuntimeChatContext(workspaceId, userId, session.agentProfileId, await this.allowedAgentIds(workspaceId), session.metadata ?? {}, session.id)
      : undefined;
    await this.enqueueChatCommand(session, 'send_message', {
      userMessageId: message.id,
      content: dto.content,
      attachmentIds,
      attachments: await Promise.all(linkedAttachments.map((attachment: any) => this.attachmentRuntimeSummary(workspaceId, attachment.id))),
      recentMessages: await this.recentChatTranscript(workspaceId, sessionId),
      context,
    });
    this.emitChat(sessionId, { type: 'user_message', message: this.chatMessageDto(message) });
    return { message: this.chatMessageDto(message), session: this.chatSessionDto(session) };
  }

  async streamChatEvents(workspaceId: string, sessionId: string): Promise<Observable<any>> {
    await this.requireChatSession(workspaceId, sessionId);
    return this.chatSubject(sessionId).asObservable();
  }

  async listArtifacts(workspaceId: string): Promise<any[]> {
    const artifacts = await this.artifacts.find({ where: { workspaceId }, order: { createdAt: 'DESC' } });
    return artifacts.map((artifact) => this.artifactDto(artifact));
  }

  async getArtifact(workspaceId: string, artifactId: string): Promise<{ artifact: any; bytes: Buffer }> {
    const artifact = await this.artifacts.findOne({ where: { id: artifactId, workspaceId } });
    if (!artifact) throw new NotFoundException('Artifact not found');
    if (!artifact.attachmentId) throw new NotFoundException('Legacy local artifact storage is no longer available for this artifact');
    const { attachment, bytes } = await this.attachments.getBytes(workspaceId, artifact.attachmentId);
    artifact.mimeType = attachment.mimeType;
    artifact.filename = attachment.filename;
    return { artifact, bytes };
  }

  async createTaskChatSession(workspaceId: string, userId: string, taskId: string): Promise<any> {
    const task = await this.tasks.findOne({ where: { id: taskId, workspaceId } });
    if (!task) throw new NotFoundException('Task not found');
    const agentProfileId = (task.metadata?.handoffTargetAgentProfileId as string | undefined) || 'orchestrator';
    if (task.status === 'done') {
      task.status = 'in_progress';
      task.metadata = {
        ...(task.metadata ?? {}),
        reopenedForRevisionAt: new Date().toISOString(),
      };
      await this.tasks.save(task);
    }
    return this.createChatSession(workspaceId, userId, {
      agentProfileId,
      metadata: {
        taskId,
        mode: 'task_continuation',
      },
    });
  }

  async registerInstance(dto: RegisterRuntimeInstanceDto): Promise<any> {
    let instance = await this.instances.findOne({ where: { instanceKey: dto.instanceKey } });
    const patch = {
      workspaceId: dto.workspaceId ?? null,
      status: 'ready' as RuntimeInstanceStatus,
      mode: dto.mode ?? 'local-docker',
      version: dto.version,
      gatewayUrl: dto.gatewayUrl,
      lastHeartbeatAt: new Date(),
      metadata: dto.metadata ?? {},
    };
    if (instance) {
      await this.instances.update(instance.id, patch);
      instance = await this.instances.findOneOrFail({ where: { id: instance.id } });
    } else {
      instance = await this.instances.save(this.instances.create({ instanceKey: dto.instanceKey, ...patch }));
    }
    return this.instanceDto(instance);
  }

  runtimeBootstrapManifest(): any {
    return {
      version: BOOTSTRAP_VERSION,
      managedPaths: BOOTSTRAP_MANAGED_PATHS,
      files: BOOTSTRAP_FILES,
    };
  }

  async heartbeat(instanceKey: string, dto: HeartbeatRuntimeInstanceDto): Promise<any> {
    const instance = await this.instances.findOne({ where: { instanceKey } });
    if (!instance) throw new NotFoundException('Runtime instance not found');
    await this.instances.update(instance.id, {
      status: (dto.status as RuntimeInstanceStatus) ?? 'ready',
      lastHeartbeatAt: new Date(),
      metadata: { ...(instance.metadata ?? {}), ...(dto.metadata ?? {}) },
    });
    return this.instanceDto(await this.instances.findOneOrFail({ where: { id: instance.id } }));
  }

  async claimNextJob(instanceKey: string): Promise<any | null> {
    const instance = await this.instances.findOne({ where: { instanceKey } });
    if (!instance) throw new NotFoundException('Runtime instance not found');
    const job = await this.jobs.findOne({
      where: [
        { status: 'queued', instanceId: instance.id },
        { status: 'queued', instanceId: IsNull() },
      ],
      order: { createdAt: 'ASC' },
    });
    if (!job) return null;
    await this.jobs.update(job.id, {
      status: 'running',
      instanceId: instance.id,
      startedAt: new Date(),
    });
    const running = await this.jobs.findOneOrFail({ where: { id: job.id } });
    const allowedAgents = await this.allowedAgentIds(running.workspaceId);
    await this.addEvent(running.workspaceId, running.id, instance.id, 'job_claimed', 'info', 'Runner claimed runtime job.', {
      instanceKey,
    });
    return {
      ...this.jobDto(running),
      allowedAgentIds: allowedAgents,
    };
  }

  async runnerEvent(instanceKey: string, jobId: string, dto: CreateRuntimeEventDto): Promise<any> {
    const { instance, job } = await this.runnerJobContext(instanceKey, jobId);
    const event = await this.addEvent(job.workspaceId, job.id, instance.id, dto.type, (dto.level as any) ?? 'info', dto.message, dto.metadata ?? {});
    return this.eventDto(event);
  }

  async completeJob(instanceKey: string, jobId: string, dto: CompleteRuntimeJobDto): Promise<any> {
    const { instance, job } = await this.runnerJobContext(instanceKey, jobId);
    await this.jobs.update(job.id, {
      status: dto.status,
      result: dto.result ?? null,
      error: dto.error ?? null,
      completedAt: new Date(),
    });
    await this.addEvent(job.workspaceId, job.id, instance.id, `job_${dto.status}`, dto.status === 'completed' ? 'info' : 'error', dto.error ?? `Runtime job ${dto.status}.`, dto.result ?? {});
    await this.applyRuntimeJobTaskSideEffects(job, dto);
    if (dto.status === 'completed' || dto.status === 'failed') {
      try {
        await this.announceJobCompletionToParent(job, dto);
      } catch (err: any) {
        await this.addEvent(job.workspaceId, job.id, instance.id, 'announce_failed', 'warn', `Announce-back failed: ${err.message}`, {});
      }
    }
    return this.jobDto(await this.jobs.findOneOrFail({ where: { id: job.id } }));
  }

  async uploadArtifact(instanceKey: string, jobId: string, dto: UploadArtifactDto): Promise<any> {
    const { job } = await this.runnerJobContext(instanceKey, jobId);
    const limits = this.normalizeLimits(job.limits ?? {});
    const extension = path.extname(dto.filename).toLowerCase();
    if (!limits.allowedExtensions.includes(extension)) {
      throw new BadRequestException(`File extension ${extension || '(none)'} is not allowed`);
    }
    const bytes = Buffer.from(dto.contentBase64, 'base64');
    if (bytes.length > limits.maxArtifactBytes) {
      throw new BadRequestException('Artifact exceeds max size');
    }
    const safeFilename = path.basename(dto.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const attachment = await this.attachments.uploadBytes(job.workspaceId, {
      filename: safeFilename,
      mimeType: dto.mimeType,
      contentBase64: dto.contentBase64,
      sizeBytes: bytes.length,
      scope: 'runtime-jobs',
      scopeId: job.id,
      source: 'runtime',
      runtimeJobId: job.id,
      taskId: job.input?.taskId,
      createdByAgentProfileId: job.agentProfileId,
      metadata: dto.metadata ?? {},
    }, { agentProfileId: job.agentProfileId });
    const artifact = await this.artifacts.save(this.artifacts.create({
      workspaceId: job.workspaceId,
      jobId: job.id,
      filename: safeFilename,
      mimeType: dto.mimeType,
      sizeBytes: bytes.length,
      storageKey: attachment.storageKey ?? attachment.id,
      attachmentId: attachment.id,
      metadata: { ...(dto.metadata ?? {}), attachmentId: attachment.id },
    }));
    await this.addEvent(job.workspaceId, job.id, job.instanceId, 'artifact_uploaded', 'info', `Artifact uploaded: ${safeFilename}`, {
      artifactId: artifact.id,
      attachmentId: attachment.id,
      sizeBytes: artifact.sizeBytes,
    });
    return this.artifactDto(artifact);
  }

  async claimNextChatCommand(instanceKey: string): Promise<any | null> {
    const instance = await this.instances.findOne({ where: { instanceKey } });
    if (!instance) throw new NotFoundException('Runtime instance not found');
    const command = await this.chatCommands.findOne({
      where: [
        { status: 'queued', instanceId: instance.id },
        { status: 'queued', instanceId: IsNull() },
      ],
      order: { createdAt: 'ASC' },
    });
    if (!command) return null;
    await this.chatCommands.update(command.id, {
      status: 'claimed',
      instanceId: instance.id,
      claimedAt: new Date(),
    });
    const claimed = await this.chatCommands.findOneOrFail({ where: { id: command.id } });
    const session = await this.chatSessions.findOneOrFail({ where: { id: claimed.sessionId } });
    const allowedAgentIds = await this.allowedAgentIds(claimed.workspaceId);
    if (!allowedAgentIds.includes(session.agentProfileId)) {
      await this.failChatCommand(claimed, `Agent ${session.agentProfileId} is not in the backend allowlist.`);
      this.emitChat(session.id, { type: 'policy_violation', content: `Agent ${session.agentProfileId} is not in the backend allowlist.` });
      return this.claimNextChatCommand(instanceKey);
    }
    this.emitChat(session.id, { type: 'command_claimed', commandId: claimed.id, commandType: claimed.type });
    return {
      ...this.chatCommandDto(claimed),
      session: this.chatSessionDto(session),
      allowedAgentIds,
    };
  }

  async completeChatCommand(instanceKey: string, commandId: string, dto: CompleteRuntimeChatCommandDto): Promise<any> {
    const { command, session } = await this.runnerChatCommandContext(instanceKey, commandId);
    await this.chatCommands.update(command.id, {
      status: dto.status,
      result: dto.result ?? null,
      error: dto.error ?? null,
      completedAt: new Date(),
    });
    const result = dto.result ?? {};
    if (dto.status === 'completed' && (result.openclawSessionKey || result.openclawSessionId)) {
      await this.chatSessions.update(session.id, {
        status: 'active',
        openclawSessionKey: result.openclawSessionKey ?? session.openclawSessionKey,
        openclawSessionId: result.openclawSessionId ?? session.openclawSessionId,
        metadata: { ...(session.metadata ?? {}), ...(result.metadata ?? {}) },
      });
    } else if (dto.status === 'failed') {
      await this.chatSessions.update(session.id, { status: 'error' });
    }
    this.emitChat(session.id, { type: `command_${dto.status}`, commandId: command.id, commandType: command.type, error: dto.error, result });
    return this.chatCommandDto(await this.chatCommands.findOneOrFail({ where: { id: command.id } }));
  }

  async runnerChatEvent(instanceKey: string, sessionId: string, dto: RuntimeChatRunnerEventDto): Promise<any> {
    const instance = await this.instances.findOne({ where: { instanceKey } });
    if (!instance) throw new NotFoundException('Runtime instance not found');
    const session = await this.chatSessions.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Runtime chat session not found');
    if (session.instanceId && session.instanceId !== instance.id) {
      throw new ForbiddenException('Runtime chat session is assigned to another instance');
    }

    let message: RuntimeChatMessage | null = null;
    if (dto.type === 'assistant_final' && dto.content) {
      message = await this.saveChatMessage(session.workspaceId, session.id, 'assistant', dto.content, 'completed', {
        runId: dto.runId,
        source: 'openclaw',
        ...(dto.metadata ?? {}),
      });
      await this.chatSessions.update(session.id, { lastMessageAt: new Date(), status: 'active' });
    } else if (dto.type === 'assistant_delta') {
      this.emitChat(session.id, { type: 'assistant_delta', content: dto.content ?? '', runId: dto.runId, metadata: dto.metadata ?? {} });
      return { ok: true };
    } else if (dto.type === 'error' && dto.content) {
      message = await this.saveChatMessage(session.workspaceId, session.id, 'system', dto.content, 'error', { runId: dto.runId, source: 'openclaw' });
      await this.chatSessions.update(session.id, { status: 'error' });
    } else if (dto.type === 'status') {
      this.emitChat(session.id, { type: 'status', status: dto.status, content: dto.content, runId: dto.runId, metadata: dto.metadata ?? {} });
      return { ok: true };
    }

    const payload = { type: dto.type, content: dto.content, status: dto.status, runId: dto.runId, message: message ? this.chatMessageDto(message) : null, metadata: dto.metadata ?? {} };
    this.emitChat(session.id, payload);
    return payload;
  }

  private async assertAgentAllowed(workspaceId: string, agentProfileId: string): Promise<void> {
    if (agentProfileId === 'orchestrator') return;
    const allowed = await this.allowedAgentIds(workspaceId);
    if (!allowed.includes(agentProfileId)) {
      throw new ForbiddenException('Agent is not allowed for this workspace');
    }
  }

  private async assertDelegationCapacity(workspaceId: string, parentChatSessionId?: string | null): Promise<void> {
    const activeWorkspace = await this.jobs.count({
      where: [
        { workspaceId, status: 'queued' as RuntimeJobStatus },
        { workspaceId, status: 'running' as RuntimeJobStatus },
      ],
    });
    if (activeWorkspace >= DELEGATION_CAPS.maxPerWorkspace) {
      throw new BadRequestException(
        `Workspace is at the delegation cap (${DELEGATION_CAPS.maxPerWorkspace} concurrent runtime jobs). Wait for an in-flight job to finish before delegating more.`,
      );
    }
    if (!parentChatSessionId) return;
    const inFlight = await this.jobs.find({
      where: [
        { workspaceId, status: 'queued' as RuntimeJobStatus },
        { workspaceId, status: 'running' as RuntimeJobStatus },
      ],
    });
    const perParent = inFlight.filter((j) => (j.input as any)?.parentChatSessionId === parentChatSessionId).length;
    if (perParent >= DELEGATION_CAPS.maxPerParentSession) {
      throw new BadRequestException(
        `This chat already has ${DELEGATION_CAPS.maxPerParentSession} delegations in flight. Wait for one to finish before delegating again.`,
      );
    }
  }

  private async announceJobCompletionToParent(job: RuntimeJob, dto: CompleteRuntimeJobDto): Promise<void> {
    const parentChatSessionId = (job.input as any)?.parentChatSessionId as string | undefined;
    if (!parentChatSessionId) return;
    const parent = await this.chatSessions.findOne({ where: { id: parentChatSessionId, workspaceId: job.workspaceId } });
    if (!parent || parent.status === 'closed') return;

    const delegatedAgentName = (job.input as any)?.delegatedAgentName as string | undefined;
    const taskId = (job.input as any)?.taskId as string | undefined;
    const outputPreview = typeof dto.result?.output === 'string' ? String(dto.result.output).slice(0, 1500) : '';
    const artifactCount = Array.isArray(dto.result?.artifacts) ? dto.result.artifacts.length : 0;
    const lines = [
      `[Nexoria announce] Specialist job ${job.id} (${delegatedAgentName ?? job.agentProfileId}) finished.`,
      `Status: ${dto.status}.`,
      taskId ? `Linked task: ${taskId}.` : null,
      artifactCount ? `Artifacts produced: ${artifactCount}.` : null,
      dto.error ? `Error: ${dto.error}.` : null,
      outputPreview ? `Output preview:\n${outputPreview}` : null,
      'Summarize this for the user and decide whether further action is needed. Do not delegate again unless the user asks for it.',
    ].filter(Boolean) as string[];
    const announceContent = lines.join('\n');

    const message = await this.saveChatMessage(parent.workspaceId, parent.id, 'system', announceContent, 'completed', {
      announce: true,
      runtimeJobId: job.id,
      runtimeJobStatus: dto.status,
      delegatedAgentName,
    });
    await this.chatSessions.update(parent.id, { lastMessageAt: new Date() });
    await this.enqueueChatCommand(parent, 'send_message', {
      userMessageId: message.id,
      content: announceContent,
      attachmentIds: [],
      attachments: [],
      recentMessages: await this.recentChatTranscript(parent.workspaceId, parent.id),
      announce: true,
      runtimeJobId: job.id,
    });
    this.emitChat(parent.id, { type: 'runtime_job_announce', message: this.chatMessageDto(message), runtimeJobId: job.id, status: dto.status });
  }

  private async requireChatSession(workspaceId: string, sessionId: string): Promise<RuntimeChatSession> {
    const session = await this.chatSessions.findOne({ where: { id: sessionId, workspaceId } });
    if (!session) throw new NotFoundException('Runtime chat session not found');
    return session;
  }

  private async allowedAgentIds(workspaceId: string): Promise<string[]> {
    const profiles = await this.agentProfiles.findEnabledByWorkspace(workspaceId);
    return ['orchestrator', ...profiles.map((profile) => profile.id)];
  }

  private async findReadyInstance(workspaceId: string): Promise<RuntimeInstance | null> {
    return this.instances.findOne({
      where: [
        { workspaceId, status: 'ready' },
        { workspaceId: IsNull(), status: 'ready' },
      ],
      order: { updatedAt: 'DESC' },
    });
  }

  private async runnerJobContext(instanceKey: string, jobId: string): Promise<{ instance: RuntimeInstance; job: RuntimeJob }> {
    const instance = await this.instances.findOne({ where: { instanceKey } });
    if (!instance) throw new NotFoundException('Runtime instance not found');
    const job = await this.jobs.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Runtime job not found');
    if (job.instanceId && job.instanceId !== instance.id) {
      throw new ForbiddenException('Runtime job is assigned to another instance');
    }
    return { instance, job };
  }

  private async runnerChatCommandContext(instanceKey: string, commandId: string): Promise<{ instance: RuntimeInstance; command: RuntimeChatCommand; session: RuntimeChatSession }> {
    const instance = await this.instances.findOne({ where: { instanceKey } });
    if (!instance) throw new NotFoundException('Runtime instance not found');
    const command = await this.chatCommands.findOne({ where: { id: commandId } });
    if (!command) throw new NotFoundException('Runtime chat command not found');
    if (command.instanceId && command.instanceId !== instance.id) {
      throw new ForbiddenException('Runtime chat command is assigned to another instance');
    }
    const session = await this.chatSessions.findOneOrFail({ where: { id: command.sessionId } });
    return { instance, command, session };
  }

  private async failChatCommand(command: RuntimeChatCommand, error: string): Promise<void> {
    await this.chatCommands.update(command.id, {
      status: 'failed',
      error,
      completedAt: new Date(),
    });
  }

  private async applyRuntimeJobTaskSideEffects(job: RuntimeJob, dto: CompleteRuntimeJobDto): Promise<void> {
    const taskId = job.input?.taskId as string | undefined;
    if (!taskId) return;

    const task = await this.tasks.findOne({ where: { id: taskId, workspaceId: job.workspaceId } });
    if (!task) return;

    const artifactIds = Array.isArray(dto.result?.artifacts)
      ? dto.result.artifacts.map((artifact: any) => artifact.id).filter(Boolean)
      : [];
    const attachmentIds = Array.isArray(dto.result?.artifacts)
      ? dto.result.artifacts.map((artifact: any) => artifact.attachmentId).filter(Boolean)
      : [];
    const output = typeof dto.result?.output === 'string' ? dto.result.output : '';
    task.status = dto.status === 'completed' ? 'done' : dto.status === 'failed' || dto.status === 'rejected' || dto.status === 'cancelled' ? 'cancelled' : task.status;
    task.metadata = {
      ...(task.metadata ?? {}),
      runtimeJobId: job.id,
      runtimeJobStatus: dto.status,
      runtimeCompletedAt: new Date().toISOString(),
      runtimeError: dto.error ?? null,
      runtimeArtifactIds: artifactIds,
      runtimeAttachmentIds: attachmentIds,
      runtimeOutputPreview: output ? output.slice(0, 500) : null,
      handoffStatus: dto.status === 'completed' ? 'completed' : `runtime_job_${dto.status}`,
    };
    await this.tasks.save(task);
  }

  private normalizeLimits(input?: Record<string, any> | null): typeof DEFAULT_LIMITS {
    const source = input ?? {};
    const allowedExtensions = Array.isArray(source.allowedExtensions)
      ? source.allowedExtensions.map((ext) => String(ext).toLowerCase()).filter((ext) => ext.startsWith('.'))
      : DEFAULT_LIMITS.allowedExtensions;
    return {
      timeoutSeconds: Math.min(Math.max(Number(source.timeoutSeconds ?? DEFAULT_LIMITS.timeoutSeconds), 10), 3600),
      maxOutputFiles: Math.min(Math.max(Number(source.maxOutputFiles ?? DEFAULT_LIMITS.maxOutputFiles), 1), 25),
      maxArtifactBytes: Math.min(Math.max(Number(source.maxArtifactBytes ?? DEFAULT_LIMITS.maxArtifactBytes), 1024), 100 * 1024 * 1024),
      allowedExtensions,
    };
  }

  private async addEvent(workspaceId: string, jobId: string | null, instanceId: string | null, type: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata: Record<string, any> | null): Promise<RuntimeEvent> {
    return this.events.save(this.events.create({ workspaceId, jobId, instanceId, type, level, message, metadata }));
  }

  private async enqueueChatCommand(session: RuntimeChatSession, type: RuntimeChatCommandType, payload: Record<string, any>): Promise<RuntimeChatCommand> {
    return this.chatCommands.save(this.chatCommands.create({
      workspaceId: session.workspaceId,
      sessionId: session.id,
      instanceId: session.instanceId,
      type,
      status: 'queued',
      payload,
    }));
  }

  private async saveChatMessage(workspaceId: string, sessionId: string, role: RuntimeChatMessageRole, content: string, status: 'pending' | 'streaming' | 'completed' | 'error', metadata: Record<string, any> = {}): Promise<RuntimeChatMessage> {
    return this.chatMessages.save(this.chatMessages.create({
      workspaceId,
      sessionId,
      role,
      content,
      status,
      metadata,
    }));
  }

  private async recentChatTranscript(workspaceId: string, sessionId: string): Promise<any[]> {
    const messages = await this.chatMessages.find({
      where: { workspaceId, sessionId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return messages.reverse().map((message) => ({
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    }));
  }

  private async buildRuntimeChatContext(workspaceId: string, userId: string, agentProfileId: string, allowedAgentIds: string[], metadata: Record<string, any> = {}, chatSessionId?: string): Promise<Record<string, any>> {
    const isOrchestrator = agentProfileId === 'orchestrator';
    const enabledAgents = await this.agentProfiles.findEnabledByWorkspace(workspaceId);
    const recentAttachments = await this.attachments.list(workspaceId, { limit: 20 });
    const taskContext = metadata.taskId ? await this.taskContext(workspaceId, String(metadata.taskId)) : null;
    return {
      workspaceId,
      userId,
      chatSessionId,
      agentProfileId,
      allowedAgentIds,
      enabledAgents: enabledAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description,
        role: agent.role,
      })),
      attachments: recentAttachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        scope: attachment.scope,
        taskId: attachment.taskId,
        runtimeJobId: attachment.runtimeJobId,
        runtimeChatSessionId: attachment.runtimeChatSessionId,
        source: attachment.source,
      })),
      taskContext,
      instructions: [
        'You are running behind Nexoria managed OpenClaw chat.',
        isOrchestrator
          ? 'You are the main Nexoria orchestrator. Stay focused on understanding the user, planning work, creating tasks/approvals, and delegating execution to background agents. Do not perform long-running work inside the main chat.'
          : 'You are a specialist agent working on delegated execution behind Nexoria.',
        'Nexoria is the canonical source for users, workspaces, approvals, and durable memory.',
        `Use only the approved agent id ${agentProfileId}.`,
        'Do not create, switch, modify, install, or configure agents.',
        'If asked to change agents or runtime configuration, say admin approval is required.',
        'Risky external actions must be routed through Nexoria approvals.',
        'Durable files live in Nexoria attachments. Use MCP attachment tools to list, refetch, reference, or upload files; local OpenClaw paths are temporary.',
        `Your active workspaceId is "${workspaceId}". Pass this exact value whenever a Nexoria MCP tool requires a workspaceId — never invent or substitute another id.`,
        chatSessionId ? `Your active chatSessionId is "${chatSessionId}". Pass this exact value as chatSessionId whenever calling enqueue_specialist_job so the specialist's result is announced back to this chat.` : 'No chatSessionId is available — announce-back will not be wired for delegations from this run.',
        'The enabled specialist agent list in this message is the current Nexoria source of truth and supersedes any older session memory or prior runtime context.',
        `Enabled specialist agents: ${enabledAgents.length > 0 ? enabledAgents.map((agent) => `${agent.name} (${agent.id})`).join(', ') : 'none'}. Delegate only to enabled agents. If the needed agent is disabled or missing, create a task or ask an admin to enable it.`,
        'Delegation model: Nexoria runs on a Nexoria-level delegation tool, NOT OpenClaw\'s sessions_spawn. Never call sessions_spawn or /subagents. Use enqueue_specialist_job instead.',
        'When work should continue in the background, call enqueue_specialist_job. If you would otherwise do the work yourself, enqueue with agentProfileId "orchestrator" so this main chat remains free.',
        'enqueue_specialist_job returns immediately with a queued runtime job. The specialist runs asynchronously and you will receive a follow-up turn in this chat prefixed with "[Nexoria announce]" when it finishes. When you receive an announce, summarize the result for the user and decide whether further action is needed.',
        'There is a cap of 5 concurrent delegations per chat and 8 per workspace. If enqueue_specialist_job returns a capacity error, tell the user the queue is full and wait for in-flight work to finish before retrying.',
        'When the user asks to create, add, track, plan, schedule, remember, assign, or capture work, call the Nexoria MCP create_task tool. Do not only describe the task in chat.',
        'When the user asks to complete, start, reopen, cancel, rename, reprioritize, or otherwise change a task, call list_tasks first if the exact task id is not known, then call update_task_status.',
        'When the user asks what tasks exist, what is pending, what is in progress, or what is done, call list_tasks.',
        ...(isOrchestrator
          ? [
              'For Facebook/social/content creation requests, do not write the final copy and do not call create_social_post_draft directly. First create a tracking task with create_task, then delegate the work with enqueue_specialist_job using agentName "Social Media Agent" and the created taskId. Include the full user brief in the delegated prompt and ask Social Media Agent to create the durable draft and review approval.',
              'After delegating content work, briefly tell the user the Social Media Agent is preparing the draft. When the announce-back arrives, summarize the outcome and any approval link.',
            ]
          : [
              'When delegated to create, draft, prepare, write, schedule, revise, approve, or publish a Facebook/social post, call create_social_post_draft or update_social_post_draft. Do not store social post copy only in chat.',
              'For Facebook post requests, use platform "facebook". Default to createReviewTask=true so Nexoria creates a pending approval and review task; only set it false when the user explicitly asks for a private draft without review.',
              'When calling create_social_post_draft from delegated social media work, include metadata.source="social_media_agent_runtime" and metadata.createdByAgentRole="social_media_agent".',
            ]),
        'If the user refers to an existing social post draft without an exact draft id, call list_social_post_drafts before updating it.',
        'Never say a task was created or updated unless the relevant Nexoria MCP tool returned successfully.',
        'Never say a social post draft was created or updated unless the relevant Nexoria MCP tool returned successfully.',
        'Never claim a file was stored durably unless a Nexoria attachment or artifact tool returned an attachmentId.',
        'After creating or updating a task or social post draft, summarize the returned id, title, status, and any linked task id.',
      ],
    };
  }

  private async taskContext(workspaceId: string, taskId: string): Promise<any | null> {
    const task = await this.tasks.findOne({ where: { id: taskId, workspaceId } });
    if (!task) return null;
    const comments = await this.taskComments.find({ where: { workspaceId, taskId }, order: { createdAt: 'ASC' }, take: 20 });
    const attachments = await this.attachments.list(workspaceId, { taskId });
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      metadata: task.metadata ?? {},
      comments: comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        authorUserId: comment.authorUserId,
        authorAgentProfileId: comment.authorAgentProfileId,
        attachmentIds: comment.attachmentIds ?? [],
        createdAt: comment.createdAt,
      })),
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        source: attachment.source,
      })),
    };
  }

  private async attachmentRuntimeSummary(workspaceId: string, attachmentId: string): Promise<any> {
    const { attachment, downloadUrl, expiresAt } = await this.attachments.getDownloadUrl(workspaceId, attachmentId);
    return {
      id: attachment.id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      scope: attachment.scope,
      taskId: attachment.taskId,
      runtimeChatSessionId: attachment.runtimeChatSessionId,
      downloadUrl,
      downloadUrlExpiresAt: expiresAt,
    };
  }

  private containsManagedPolicyViolation(content: string): boolean {
    return [
      /create\s+(a\s+)?(new\s+)?agent/i,
      /add\s+(a\s+)?(new\s+)?agent/i,
      /modify\s+(the\s+)?agents?/i,
      /switch\s+(to\s+)?(another\s+)?agent/i,
      /openclaw\s+config\s+set/i,
      /config\s+set/i,
    ].some((pattern) => pattern.test(content));
  }

  private chatSubject(sessionId: string): Subject<any> {
    let subject = this.chatStreams.get(sessionId);
    if (!subject || subject.closed) {
      subject = new Subject<any>();
      this.chatStreams.set(sessionId, subject);
    }
    return subject;
  }

  private cleanupChatStreams(): void {
    for (const [sessionId, subject] of this.chatStreams) {
      if (subject.closed || subject.observers.length === 0) {
        subject.complete();
        this.chatStreams.delete(sessionId);
      }
    }
  }

  private emitChat(sessionId: string, payload: any): void {
    this.chatSubject(sessionId).next({
      data: {
        ...payload,
        sessionId,
        emittedAt: new Date().toISOString(),
      },
    });
  }

  private instanceDto(instance: RuntimeInstance): any {
    return {
      id: instance.id,
      instanceKey: instance.instanceKey,
      workspaceId: instance.workspaceId,
      status: instance.status,
      mode: instance.mode,
      version: instance.version,
      gatewayUrl: instance.gatewayUrl,
      lastHeartbeatAt: instance.lastHeartbeatAt,
      metadata: instance.metadata ?? {},
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
    };
  }

  private jobDto(job: RuntimeJob): any {
    return {
      id: job.id,
      workspaceId: job.workspaceId,
      instanceId: job.instanceId,
      requestedByUserId: job.requestedByUserId,
      agentProfileId: job.agentProfileId,
      type: job.type,
      status: job.status,
      input: job.input ?? {},
      limits: job.limits ?? {},
      result: job.result ?? null,
      error: job.error,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private eventDto(event: RuntimeEvent): any {
    return {
      id: event.id,
      workspaceId: event.workspaceId,
      jobId: event.jobId,
      instanceId: event.instanceId,
      type: event.type,
      level: event.level,
      message: event.message,
      metadata: event.metadata ?? {},
      createdAt: event.createdAt,
    };
  }

  private artifactDto(artifact: Artifact): any {
    return {
      id: artifact.id,
      workspaceId: artifact.workspaceId,
      jobId: artifact.jobId,
      filename: artifact.filename,
      mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes,
      attachmentId: artifact.attachmentId,
      downloadUrl: `/api/v1/workspaces/${artifact.workspaceId}/artifacts/${artifact.id}/download`,
      metadata: artifact.metadata ?? {},
      createdAt: artifact.createdAt,
    };
  }

  private chatSessionDto(session: RuntimeChatSession): any {
    return {
      id: session.id,
      workspaceId: session.workspaceId,
      userId: session.userId,
      agentProfileId: session.agentProfileId,
      instanceId: session.instanceId,
      openclawSessionKey: session.openclawSessionKey,
      openclawSessionId: session.openclawSessionId,
      status: session.status,
      metadata: session.metadata ?? {},
      lastMessageAt: session.lastMessageAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private chatMessageDto(message: RuntimeChatMessage): any {
    return {
      id: message.id,
      workspaceId: message.workspaceId,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      status: message.status,
      openclawMessageId: message.openclawMessageId,
      metadata: message.metadata ?? {},
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  private chatCommandDto(command: RuntimeChatCommand): any {
    return {
      id: command.id,
      workspaceId: command.workspaceId,
      sessionId: command.sessionId,
      instanceId: command.instanceId,
      type: command.type,
      status: command.status as RuntimeChatCommandStatus,
      payload: command.payload ?? {},
      result: command.result ?? null,
      error: command.error,
      claimedAt: command.claimedAt,
      completedAt: command.completedAt,
      createdAt: command.createdAt,
      updatedAt: command.updatedAt,
    };
  }
}
