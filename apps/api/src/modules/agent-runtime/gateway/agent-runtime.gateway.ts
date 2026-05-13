import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ModuleRef } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as nacl from 'tweetnacl';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { RuntimeInstance } from '../../../database/entities/runtime-instance.entity';
import { ManagedRuntimeService } from '../../managed-runtime/managed-runtime.service';
import { TasksService } from '../../tasks/tasks.service';

interface AuthSocket extends Socket {
  data: {
    userId?: string;
    workspaceId?: string;
    instanceKey?: string;
    isProAgent?: boolean;
    nonce?: string;
  };
}

const getTokenFromHandshake = (client: AuthSocket): string | undefined => {
  const auth = client.handshake.auth?.token || client.handshake.query?.token;
  return Array.isArray(auth) ? auth[0] : auth;
};

@WebSocketGateway({
  namespace: 'agent-runtime',
  cors: { origin: '*' },
})
export class AgentRuntimeGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AgentRuntimeGateway.name);
  private readonly instanceSockets = new Map<string, AuthSocket>();
  private managedRuntime!: ManagedRuntimeService;
  private tasksService!: TasksService;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(RuntimeInstance)
    private readonly instances: Repository<RuntimeInstance>,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    this.managedRuntime = this.moduleRef.get(ManagedRuntimeService, { strict: false });
    this.tasksService = this.moduleRef.get(TasksService, { strict: false });
  }

  @OnEvent('task.task.created')
  handleTaskCreated(event: { workspaceId: string; task?: any }) {
    if (!event.task) return;
    this.emitToWorkspace(event.workspaceId, 'chat.action_card', {
      type: 'task',
      id: event.task.id,
      title: event.task.title,
      description: event.task.description,
      status: event.task.status,
      priority: event.task.priority,
      metadata: event.task.metadata,
    });
  }

  // ───── Connections ─────

  async handleConnection(client: AuthSocket) {
    const token = getTokenFromHandshake(client);

    try {
      if (!token) {
        await this.authenticateProAgent(client);
      } else if (token.startsWith('Bearer ')) {
        const rawToken = token.replace('Bearer ', '');
        const proAgentToken = process.env.NEXORIA_PRO_AGENT_TOKEN;
        if (proAgentToken && rawToken === proAgentToken) {
          await this.authenticateProAgent(client);
        } else {
          await this.authenticateFrontend(client, rawToken);
        }
      } else {
        await this.authenticateProAgent(client);
      }
    } catch (err: any) {
      this.logger.warn(`Socket ${client.id}: auth failed — ${err.message}`);
      return client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthSocket) {
    this.logger.log(`Socket ${client.id} disconnected`);
    if (client.data.instanceKey) {
      this.instanceSockets.delete(client.data.instanceKey);
      void this.instances.update({ instanceKey: client.data.instanceKey } as any, { status: 'offline' as any });
    }
  }

  // ───── Auth: Frontend (JWT) ─────

  private async authenticateFrontend(client: AuthSocket, token: string) {
    const secret = this.config.get('app.jwtSecret');
    const decoded = jwt.verify(token, secret) as { sub: string; email?: string };
    client.data.userId = decoded.sub;
    const workspaceId = (client.handshake.auth?.workspaceId as string) || undefined;
    client.data.workspaceId = workspaceId;
    const room = `workspace:${workspaceId || 'global'}`;
    void client.join(room);
    this.logger.log(`FE socket ${client.id} joined ${room}`);
  }

  // ───── Auth: Pro Agent (Challenge / Response) ─────

  private async authenticateProAgent(client: AuthSocket) {
    const nonce = randomBytes(32).toString('base64');
    client.data.nonce = nonce;
    client.emit('auth_challenge', { nonce });

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new UnauthorizedException('auth timeout')), 15000);

      client.once('auth_response', async (payload: { instanceKey: string; signature: string; workspaceId?: string }) => {
        clearTimeout(timer);
        try {
          const instance = await this.instances.findOneOrFail({
            where: { instanceKey: payload.instanceKey },
          });
          const pubKeyBase64 = instance.metadata?.ed25519PublicKey;
          if (!pubKeyBase64) throw new UnauthorizedException('No Ed25519 pubkey registered');
          const pubKey = Buffer.from(pubKeyBase64, 'base64');
          const message = Buffer.from(nonce, 'utf8');
          const signature = Buffer.from(payload.signature, 'base64');
          const ok = nacl.sign.detached.verify(message, signature, pubKey);
          if (!ok) throw new UnauthorizedException('Invalid Ed25519 signature');

          const workspaceId = instance.workspaceId || payload.workspaceId || undefined;
          client.data.instanceKey = payload.instanceKey;
          client.data.isProAgent = true;
          client.data.workspaceId = workspaceId;

          this.instanceSockets.set(payload.instanceKey, client);

          const wsRoom = `workspace:${workspaceId || 'global'}`;
          void client.join(wsRoom);
          void client.join(`instance:${payload.instanceKey}`);
          this.logger.log(`Pro Agent socket ${client.id} joined ${wsRoom}`);

          resolve();
        } catch (e: any) {
          reject(e);
        }
      });
    });
  }

  // ───── Helpers ─────

  isInstanceConnected(instanceKey: string): boolean {
    const socket = this.instanceSockets.get(instanceKey);
    return !!socket && socket.connected;
  }

  emitToWorkspace(workspaceId: string, event: string, payload: any) {
    this.server.to(`workspace:${workspaceId}`).emit(event, payload);
  }

  emitToInstance(instanceKey: string, event: string, payload: any) {
    this.server.to(`instance:${instanceKey}`).emit(event, payload);
  }

  // ───── Events received from FE ─────

  @SubscribeMessage('chat.send')
  async handleChatSend(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { sessionId: string; content: string; attachmentIds?: string[]; runtimeMode?: string; runtimeProvider?: string },
  ) {
    const userId = client.data.userId;
    const workspaceId = client.data.workspaceId;
    if (!userId || !workspaceId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }
    try {
      const result = await this.managedRuntime.sendChatMessage(workspaceId, userId, body.sessionId, {
        content: body.content,
        attachmentIds: body.attachmentIds,
        runtimeMode: body.runtimeMode as any,
        runtimeProvider: body.runtimeProvider as any,
      });
      this.emitToWorkspace(workspaceId, 'chat.user_message', result);
    } catch (e: any) {
      client.emit('error', { message: e.message || 'Failed to send message' });
    }
  }

  // ───── Events received from Pro Agent ─────

  @SubscribeMessage('job.claim')
  async handleJobClaim(@ConnectedSocket() client: AuthSocket) {
    if (!client.data.isProAgent || !client.data.instanceKey) {
      client.emit('error', { message: 'Only runtime instances can claim jobs' });
      return;
    }
    try {
      const job = await this.managedRuntime.claimNextJob(client.data.instanceKey);
      client.emit('job.claimed', job);
    } catch (e: any) {
      client.emit('error', { message: e.message || 'Claim failed' });
    }
  }

  @SubscribeMessage('job.complete')
  async handleJobComplete(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    body: { jobId: string; status: string; result?: Record<string, any>; error?: string },
  ) {
    if (!client.data.isProAgent || !client.data.instanceKey) {
      client.emit('error', { message: 'Only runtime instances can complete jobs' });
      return;
    }
    try {
      const result = await this.managedRuntime.completeJob(client.data.instanceKey, body.jobId, {
        status: body.status as any,
        result: body.result,
        error: body.error,
      });
      client.emit('job.completed', result);
    } catch (e: any) {
      client.emit('error', { message: e.message || 'Complete failed' });
    }
  }

  @SubscribeMessage('chat.chunk')
  handleChatChunk(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { sessionId: string; jobId: string; content: string },
  ) {
    if (!client.data.isProAgent) return;
    const workspaceId = client.data.workspaceId;
    if (!workspaceId) return;
    this.emitToWorkspace(workspaceId, 'chat.assistant_delta', {
      sessionId: body.sessionId,
      content: body.content,
      jobId: body.jobId,
    });
  }

  @SubscribeMessage('chat.final')
  async handleChatFinal(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { sessionId: string; jobId: string; content: string },
  ) {
    if (!client.data.isProAgent) return;
    const workspaceId = client.data.workspaceId;
    if (!workspaceId) return;
    try {
      await this.managedRuntime.finalizeNativeProChatJob(
        client.data.instanceKey!,
        body.jobId,
        body.sessionId,
        body.content,
      );
    } catch (e: any) {
      client.emit('error', { message: e.message || 'Failed to finalize chat message' });
    }
  }

  @SubscribeMessage('job.event')
  async handleJobEvent(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    body: { jobId: string; type: string; level: string; message: string; metadata?: Record<string, any> },
  ) {
    if (!client.data.isProAgent || !client.data.instanceKey) return;
    try {
      await this.managedRuntime.runnerEvent(client.data.instanceKey, body.jobId, {
        type: body.type,
        level: body.level as any,
        message: body.message,
        metadata: body.metadata,
      });
    } catch {
      // ignore
    }
  }

  @SubscribeMessage('task.create')
  async handleTaskCreate(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { title: string; description?: string; metadata?: Record<string, any> },
  ) {
    if (!client.data.isProAgent) {
      client.emit('error', { message: 'Only Pro Agent can create tasks via WS' });
      return null;
    }
    const workspaceId = client.data.workspaceId;
    if (!workspaceId) {
      client.emit('error', { message: 'No workspace' });
      return null;
    }
    try {
      const task = await this.tasksService.create(workspaceId, {
        title: body.title,
        description: body.description || '',
        metadata: body.metadata ?? {},
      });
      return task;
    } catch (e: any) {
      client.emit('error', { message: e.message });
      return null;
    }
  }

  @SubscribeMessage('task.update')
  async handleTaskUpdate(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { taskId: string; patch: Record<string, any> },
  ) {
    if (!client.data.isProAgent) return null;
    const workspaceId = client.data.workspaceId;
    if (!workspaceId) return null;
    try {
      const task = await this.tasksService.update(body.taskId, workspaceId, body.patch);
      return task;
    } catch {
      return null;
    }
  }
}
