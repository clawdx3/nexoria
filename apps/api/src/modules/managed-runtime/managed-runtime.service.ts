import { BadRequestException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
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
import { Task } from '../../database/entities/task.entity';
import { TaskComment } from '../../database/entities/task-comment.entity';
import {
  CompleteRuntimeJobDto,
  CreateRuntimeChatSessionDto,
  CreateRuntimeEventDto,
  CreateRuntimeJobDto,
  DelegateToSpecialistDto,
  HeartbeatRuntimeInstanceDto,
  RegisterRuntimeInstanceDto,
  SendRuntimeChatMessageDto,
  UploadArtifactDto,
} from './dto/managed-runtime.dto';
import { MemoryContextBuilder } from '../agent-runtime/memory-context/memory-context.builder';
import { ReflectionDebouncerService } from '../agent-runtime/reflection/reflection-debouncer.service';
import { AgentContext } from '../../shared/interfaces/agent.interfaces';
import { AgentLoopService } from '../agent-runtime/loop/agent-loop.service';
import { AgentRuntimeGateway } from '../agent-runtime/gateway/agent-runtime.gateway';
import { UsageTrackingService } from '../billing/usage-tracking.service';

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
  constructor(
    @InjectRepository(RuntimeInstance) private readonly instances: Repository<RuntimeInstance>,
    @InjectRepository(RuntimeJob) private readonly jobs: Repository<RuntimeJob>,
    @InjectRepository(RuntimeEvent) private readonly events: Repository<RuntimeEvent>,
    @InjectRepository(Artifact) private readonly artifacts: Repository<Artifact>,
    @InjectRepository(RuntimeChatSession) private readonly chatSessions: Repository<RuntimeChatSession>,
    @InjectRepository(RuntimeChatMessage) private readonly chatMessages: Repository<RuntimeChatMessage>,
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(TaskComment) private readonly taskComments: Repository<TaskComment>,
    private readonly agentProfiles: AgentProfilesService,
    private readonly attachments: AttachmentsService,
    private readonly memoryBuilder: MemoryContextBuilder,
    private readonly reflectionDebouncer: ReflectionDebouncerService,
    private readonly agentLoopService: AgentLoopService,
    private readonly gateway: AgentRuntimeGateway,
    private readonly usageTracking: UsageTrackingService,
  ) {}

  async createJob(workspaceId: string, requestedByUserId: string | null, dto: CreateRuntimeJobDto, instanceId?: string): Promise<any> {
    await this.assertAgentAllowed(workspaceId, dto.agentProfileId);
    await this.assertDelegationCapacity(workspaceId, dto.input?.parentChatSessionId);
    const targetInstance = instanceId
      ? await this.instances.findOne({ where: { id: instanceId } })
      : await this.findReadyInstance(workspaceId);
    const job = this.jobs.create({
      workspaceId,
      requestedByUserId,
      instanceId: targetInstance?.id ?? null,
      agentProfileId: dto.agentProfileId,
      type: dto.type ?? 'create_file',
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
    const session = await this.chatSessions.save(this.chatSessions.create({
      workspaceId,
      userId,
      agentProfileId,
      instanceId: instance?.id ?? null,
      status: 'pending',
      metadata: dto.metadata ?? {},
    }));
    this.emitChat(workspaceId, session.id, { type: 'session_created', session: this.chatSessionDto(session) });
    return this.chatSessionDto(session);
  }

  async listChatSessions(workspaceId: string, userId: string): Promise<any[]> {
    const sessions = await this.chatSessions.find({
      where: { workspaceId, userId },
      order: { lastMessageAt: 'DESC' },
      take: 50,
    });
    return sessions.map(s => this.chatSessionDto(s));
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

    const attachmentIds = dto.attachmentIds ?? [];
    if (attachmentIds.length) await this.attachments.getMany(workspaceId, attachmentIds);
    const message = await this.saveChatMessage(workspaceId, sessionId, 'user', dto.content, 'completed', { userId, attachmentIds });
    const linkedAttachments = attachmentIds.length
      ? await this.attachments.linkToChatMessage(workspaceId, attachmentIds, message.id, sessionId)
      : [];
    await this.chatSessions.update(sessionId, { lastMessageAt: new Date() });
    this.usageTracking.track(workspaceId, { messagesSent: 1 }).catch(() => {});

    const profile = await this.agentProfiles.findOne(session.agentProfileId);
    const effectiveMode = (dto as any).runtimeMode ?? profile?.runtimeMode ?? 'native_saas';

    if (effectiveMode === 'native_saas') {
      const agentCtx: AgentContext = {
        workspaceId,
        triggeredByUserId: userId,
        userRole: 'user',
        autonomyLevel: 1,
        sessionId,
        agentProfile: {
          id: profile.id,
          name: profile.name,
          systemPrompt: profile.systemPrompt,
          modelProvider: (profile.modelProvider || 'openai') as any,
          modelName: profile.modelName || 'gpt-4o',
          modelConfig: profile.modelConfig ?? {},
          enabledTools: profile.enabledTools ?? [],
          role: profile.role ?? 'orchestrator',
        },
      };

      this.emitChat(workspaceId, sessionId, { type: 'user_message', message: this.chatMessageDto(message) });

      const recentMessages = await this.recentChatTranscript(workspaceId, sessionId);
      const existingMessages = recentMessages.map(m => ({ role: m.role, content: m.content }));

      this.agentLoopService.run(agentCtx, dto.content, (chunk) => {
        if (chunk.type === 'token') {
          this.emitChat(workspaceId, sessionId, { type: 'assistant_delta', content: chunk.content ?? '', runId: sessionId });
        } else if (chunk.type === 'tool_call_start') {
          this.emitChat(workspaceId, sessionId, { type: 'status', status: 'running', content: `Using tool: ${chunk.toolName}`, runId: sessionId });
        } else if (chunk.type === 'tool_result') {
          this.emitChat(workspaceId, sessionId, { type: 'status', status: 'running', content: `Tool result: ${JSON.stringify(chunk.result).slice(0, 200)}`, runId: sessionId });
        } else if (chunk.type === 'final') {
          // final handled below after run resolves
        } else if (chunk.type === 'error') {
          this.emitChat(workspaceId, sessionId, { type: 'error', content: chunk.error, runId: sessionId });
        }
      }, existingMessages).then(async (result) => {
        if (result.success && result.finalOutput) {
          const assistant = await this.saveChatMessage(workspaceId, sessionId, 'assistant', result.finalOutput, 'completed', {
            runId: sessionId,
            source: 'native_saas',
          });
          this.emitChat(workspaceId, sessionId, { type: 'assistant_final', content: result.finalOutput, runId: sessionId, message: this.chatMessageDto(assistant) });
          await this.chatSessions.update(sessionId, { status: 'active', lastMessageAt: new Date() });
          if (session.userId) {
            this.reflectionDebouncer.schedule(session.workspaceId, session.id, session.userId);
          }
        } else if ((result as any).interruptedByApprovalId) {
          const approvalId = (result as any).interruptedByApprovalId;
          const pendingMsg = await this.saveChatMessage(workspaceId, sessionId, 'system', result.error || 'Waiting for user approval...', 'pending', {
            runId: sessionId,
            approvalId,
            source: 'native_saas',
          });
          this.emitChat(workspaceId, sessionId, { type: 'status', status: 'pending', content: result.error || 'Waiting for user approval...', runId: sessionId, approvalId, message: this.chatMessageDto(pendingMsg) });
        } else {
          const errMsg = result.error || 'Agent loop failed';
          const system = await this.saveChatMessage(workspaceId, sessionId, 'system', errMsg, 'error', { runId: sessionId, source: 'native_saas' });
          this.emitChat(workspaceId, sessionId, { type: 'error', content: errMsg, runId: sessionId, message: this.chatMessageDto(system) });
          await this.chatSessions.update(sessionId, { status: 'error' });
        }
      });

      return { message: this.chatMessageDto(message), session: this.chatSessionDto(session) };
    }

    if (effectiveMode === 'native_pro') {
      const readyInstance = await this.findReadyInstance(workspaceId, 'pro-agent');
      if (!readyInstance) {
        const system = await this.saveChatMessage(workspaceId, sessionId, 'system', 'No Pro Agent instance is registered for this workspace. Start the pro-agent container or set the agent runtimeMode to native_saas.', 'error', {});
        this.emitChat(workspaceId, sessionId, { type: 'error', content: system.content, runId: sessionId, message: this.chatMessageDto(system) });
        return { message: this.chatMessageDto(system), session: this.chatSessionDto(session) };
      }
      this.emitChat(workspaceId, sessionId, { type: 'user_message', message: this.chatMessageDto(message) });
      this.emitChat(workspaceId, sessionId, { type: 'status', status: 'running', content: 'Routing to Pro Agent...', runId: sessionId });

      const job = await this.createJob(workspaceId, userId, {
        agentProfileId: session.agentProfileId,
        type: 'native_pro_chat',
        input: {
          chatSessionId: session.id,
          userMessageId: message.id,
          userId,
          content: dto.content,
          attachmentIds,
          recentMessages: await this.recentChatTranscript(workspaceId, sessionId),
          parentChatSessionId: session.id,
        },
      }, readyInstance.id);

      if (this.gateway.isInstanceConnected(readyInstance.instanceKey)) {
        await this.jobs.update(job.id, { status: 'running', startedAt: new Date() });
        this.gateway.emitToInstance(readyInstance.instanceKey, 'job.pushed', this.jobDto(await this.jobs.findOneOrFail({ where: { id: job.id } })));
      }

      return { message: this.chatMessageDto(message), session: this.chatSessionDto(session), jobId: job.id };
    }

    throw new BadRequestException(`Unsupported runtime mode: ${effectiveMode}`);
  }

  async streamChatEvents(workspaceId: string, sessionId: string): Promise<Observable<any>> {
    await this.requireChatSession(workspaceId, sessionId);
    return new Observable();
  }

  async delegateToSpecialist(workspaceId: string, userId: string, dto: DelegateToSpecialistDto): Promise<any> {
    let profile = await this.agentProfiles.findOne(dto.specialistId).catch(() => null);
    if (!profile) {
      const all = await this.agentProfiles.findEnabledByWorkspace(workspaceId);
      profile = all.find(p => p.name.toLowerCase() === dto.specialistId.toLowerCase()) ?? null;
    }
    if (!profile) throw new NotFoundException(`Specialist agent not found: ${dto.specialistId}`);

    const agentCtx: AgentContext = {
      workspaceId,
      triggeredByUserId: userId,
      userRole: 'user',
      autonomyLevel: profile.defaultAutonomyLevel ?? 2,
      agentProfile: {
        id: profile.id,
        name: profile.name,
        systemPrompt: profile.systemPrompt,
        modelProvider: (profile.modelProvider || 'ollama') as any,
        modelName: profile.modelName || 'gpt-4o',
        modelConfig: profile.modelConfig ?? {},
        enabledTools: profile.enabledTools ?? [],
        role: profile.role ?? 'specialist',
      },
    };

    const result = await this.agentLoopService.run(agentCtx, dto.prompt);
    return {
      specialistId: profile.id,
      specialistName: profile.name,
      success: result.success,
      output: result.finalOutput,
      error: result.error,
    };
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
        { status: 'queued' as const, instanceId: IsNull() },
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

  async completeNativeProChatJob(
    instanceKey: string,
    jobId: string,
    dto: CompleteRuntimeJobDto,
  ): Promise<any> {
    const { instance, job } = await this.runnerJobContext(instanceKey, jobId);
    if (job.type !== 'native_pro_chat') {
      throw new BadRequestException('Job type mismatch: expected native_pro_chat');
    }

    const chatSessionId = job.input?.chatSessionId as string;
    const workspaceId = job.workspaceId;

    await this.jobs.update(jobId, {
      status: dto.status,
      result: dto.result ?? null,
      error: dto.error ?? null,
      completedAt: new Date(),
    });

    await this.addEvent(workspaceId, jobId, instance.id,
      `native_pro_${dto.status}`,
      dto.status === 'completed' ? 'info' : 'error',
      dto.error ?? `Native pro job ${dto.status}.`,
      dto.result ?? {},
    );

    const tokensUsed = dto.result?.tokensUsed as number | undefined;
    if (tokensUsed) {
      this.usageTracking.track(workspaceId, { tokensUsed }).catch(() => {});
    }

    if (dto.status === 'completed' && typeof dto.result?.output === 'string' && chatSessionId) {
      const signedOutput = `[Pro Agent]\n${dto.result.output}`;
      const assistant = await this.saveChatMessage(workspaceId, chatSessionId, 'assistant', signedOutput, 'completed', {
        source: 'native_pro',
        runtimeJobId: jobId,
      });
      this.emitChat(workspaceId, chatSessionId, {
        type: 'assistant_final',
        content: dto.result.output,
        runId: jobId,
        message: this.chatMessageDto(assistant),
      });
      await this.chatSessions.update(chatSessionId, { status: 'active', lastMessageAt: new Date() });

      const session = await this.chatSessions.findOne({ where: { id: chatSessionId } });
      if (session?.userId) {
        this.reflectionDebouncer.schedule(session.workspaceId, session.id, session.userId);
      }
    } else if (dto.error && chatSessionId) {
      const system = await this.saveChatMessage(workspaceId, chatSessionId, 'system', dto.error, 'error', {
        source: 'native_pro',
        runtimeJobId: jobId,
      });
      this.emitChat(workspaceId, chatSessionId, {
        type: 'error',
        content: dto.error,
        runId: jobId,
        message: this.chatMessageDto(system),
      });
      await this.chatSessions.update(chatSessionId, { status: 'error' });
    }

    return this.jobDto(await this.jobs.findOneOrFail({ where: { id: jobId } }));
  }

  async completeJob(instanceKey: string, jobId: string, dto: CompleteRuntimeJobDto): Promise<any> {
    const { instance, job } = await this.runnerJobContext(instanceKey, jobId);
    if (job.type === 'native_pro_chat') {
      return this.completeNativeProChatJob(instanceKey, jobId, dto);
    }
    await this.jobs.update(job.id, {
      status: dto.status,
      result: dto.result ?? null,
      error: dto.error ?? null,
      completedAt: new Date(),
    });
    await this.addEvent(job.workspaceId, job.id, instance.id, `job_${dto.status}`, dto.status === 'completed' ? 'info' : 'error', dto.error ?? `Runtime job ${dto.status}.`, dto.result ?? {});
    await this.applyRuntimeJobTaskSideEffects(job, dto);
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
    return Promise.resolve();
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

  private async findReadyInstance(workspaceId: string, mode?: string): Promise<RuntimeInstance | null> {
    const where: any = { status: 'ready' };
    if (mode) where.mode = mode;
    return this.instances.findOne({
      where: [
        { ...where, workspaceId },
        { ...where, workspaceId: IsNull() },
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

  private emitChat(workspaceId: string, sessionId: string, payload: any): void {
    this.gateway.emitToWorkspace(workspaceId, `chat.${payload.type}`, {
      ...payload,
      sessionId,
      emittedAt: new Date().toISOString(),
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
      metadata: message.metadata ?? {},
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  @OnEvent('approval.decided')
  async handleApprovalDecided(event: { approvalId: string; workspaceId: string; status: string; outcome: string; sessionId?: string; agentProfileId?: string }) {
    if (!event.sessionId) return;

    const pendingMessages = await this.chatMessages.find({
      where: {
        workspaceId: event.workspaceId,
        sessionId: event.sessionId,
        status: 'pending' as any,
      },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    const pendingMsg = pendingMessages[0];
    if (!pendingMsg) return;

    if (event.outcome === 'approve') {
      await this.chatMessages.update(pendingMsg.id, { status: 'completed' as any });
      this.emitChat(event.workspaceId, event.sessionId, {
        type: 'status',
        status: 'approved',
        content: 'Approval granted. Resuming...',
        runId: event.sessionId,
        approvalId: event.approvalId,
      });

      const session = await this.chatSessions.findOne({ where: { id: event.sessionId } }).catch(() => null);
      if (!session) return;

      const profile = await this.agentProfiles.findOne(session.agentProfileId).catch(() => null);
      if (!profile) return;

      const recentMessages = await this.recentChatTranscript(event.workspaceId, event.sessionId);
      const existingMessages = recentMessages.map(m => ({ role: m.role, content: m.content }));

      const agentCtx: AgentContext = {
        workspaceId: event.workspaceId,
        triggeredByUserId: session.userId || 'system',
        userRole: 'user',
        autonomyLevel: 1,
        sessionId: event.sessionId,
        agentProfile: {
          id: profile.id,
          name: profile.name,
          systemPrompt: profile.systemPrompt,
          modelProvider: (profile.modelProvider || 'openai') as any,
          modelName: profile.modelName || 'gpt-4o',
          modelConfig: profile.modelConfig ?? {},
          enabledTools: profile.enabledTools ?? [],
          role: profile.role ?? 'orchestrator',
        },
      };

      this.agentLoopService.run(agentCtx, 'The user approved the pending action. Please continue where you left off.', (chunk) => {
        if (chunk.type === 'token') {
          this.emitChat(event.workspaceId, event.sessionId!, { type: 'assistant_delta', content: chunk.content ?? '', runId: event.sessionId });
        } else if (chunk.type === 'tool_call_start') {
          this.emitChat(event.workspaceId, event.sessionId!, { type: 'status', status: 'running', content: `Using tool: ${chunk.toolName}`, runId: event.sessionId });
        } else if (chunk.type === 'tool_result') {
          this.emitChat(event.workspaceId, event.sessionId!, { type: 'status', status: 'running', content: `Tool result: ${JSON.stringify(chunk.result).slice(0, 200)}`, runId: event.sessionId });
        } else if (chunk.type === 'error') {
          this.emitChat(event.workspaceId, event.sessionId!, { type: 'error', content: chunk.error, runId: event.sessionId });
        }
      }, existingMessages).then(async (result) => {
        if (result.success && result.finalOutput) {
          const assistant = await this.saveChatMessage(event.workspaceId, event.sessionId!, 'assistant', result.finalOutput, 'completed', {
            runId: event.sessionId,
            source: 'native_saas',
            resumedAfterApproval: event.approvalId,
          });
          this.emitChat(event.workspaceId, event.sessionId!, { type: 'assistant_final', content: result.finalOutput, runId: event.sessionId, message: this.chatMessageDto(assistant) });
          await this.chatSessions.update(event.sessionId!, { status: 'active', lastMessageAt: new Date() });
        } else if ((result as any).interruptedByApprovalId) {
          const newApprovalId = (result as any).interruptedByApprovalId;
          const newPending = await this.saveChatMessage(event.workspaceId, event.sessionId!, 'system', result.error || 'Waiting for user approval...', 'pending', {
            runId: event.sessionId,
            approvalId: newApprovalId,
            source: 'native_saas',
          });
          this.emitChat(event.workspaceId, event.sessionId!, { type: 'status', status: 'pending', content: result.error || 'Waiting for user approval...', runId: event.sessionId, approvalId: newApprovalId, message: this.chatMessageDto(newPending) });
        } else {
          const errMsg = result.error || 'Agent loop failed after approval resume';
          const sys = await this.saveChatMessage(event.workspaceId, event.sessionId!, 'system', errMsg, 'error', { runId: event.sessionId, source: 'native_saas' });
          this.emitChat(event.workspaceId, event.sessionId!, { type: 'error', content: errMsg, runId: event.sessionId, message: this.chatMessageDto(sys) });
        }
      });
    } else if (event.outcome === 'reject') {
      await this.chatMessages.update(pendingMsg.id, { status: 'error' as any });
      const rejectMsg = await this.saveChatMessage(event.workspaceId, event.sessionId, 'assistant', 'The user rejected the pending action.', 'completed', {
        runId: event.sessionId,
        source: 'native_saas',
        rejectedApprovalId: event.approvalId,
      });
      this.emitChat(event.workspaceId, event.sessionId, {
        type: 'assistant_final',
        content: 'The user rejected the pending action.',
        runId: event.sessionId,
        message: this.chatMessageDto(rejectMsg),
      });
      await this.chatSessions.update(event.sessionId, { status: 'active', lastMessageAt: new Date() });
    }
  }
}
