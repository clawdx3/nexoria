import { Socket, io } from 'socket.io-client';
import { Config } from './config';
import { signMessage, getPublicKeyBase64 } from './keys/keys';

export interface ProAgentApiClient {
  registerInstance(instanceKey: string, metadata: Record<string, any>): Promise<void>;
  heartbeat(instanceKey: string, status: string): Promise<void>;
  claimNextJob(instanceKey: string): Promise<any | null>;
  completeJob(instanceKey: string, jobId: string, result: any): Promise<void>;
  postEvent(instanceKey: string, jobId: string, event: any): Promise<void>;
  onJobPushed(callback: (job: any) => void): void;
  onAuthChallenge(callback: (payload: { nonce: string }) => void): void;
  connect(): Promise<void>;
  disconnect(): void;
  emitChatChunk(sessionId: string, jobId: string, content: string): void;
  emitChatFinal(sessionId: string, jobId: string, content: string): void;
  emitJobComplete(instanceKey: string, jobId: string, data: { status: string; result?: Record<string, any>; error?: string }): void;
  emitJobEvent(instanceKey: string, jobId: string, data: any): void;
}

export class WsProAgentApiClient implements ProAgentApiClient {
  private socket: Socket | null = null;
  private _onJobPushed: ((job: any) => void) | null = null;
  private _onAuthChallenge: ((payload: { nonce: string }) => void) | null = null;

  constructor(private readonly config: Config) {}

  async connect(): Promise<void> {
    const wsUrl = this.config.nexoriaApiUrl.replace('/api/v1', '') + '/agent-runtime';
    this.socket = io(wsUrl, {
      transports: ['websocket'],
    });

    return new Promise((resolve, reject) => {
      this.socket!.on('connect', () => {
        console.log('[WS] Connected');
      });

      this.socket!.on('auth_challenge', (payload: { nonce: string }) => {
        if (this._onAuthChallenge) {
          this._onAuthChallenge(payload);
        } else {
          this.respondToAuthChallenge(payload);
        }
      });

      this.socket!.on('job.pushed', (job: any) => {
        if (this._onJobPushed) this._onJobPushed(job);
      });

      this.socket!.on('error', (err: any) => {
        console.error('[WS] Error:', err);
      });

      this.socket!.on('connect_error', (err: any) => {
        console.error('[WS] Connection error:', err.message);
        reject(err);
      });

      // Resolve once first message arrives or on a short timeout
      setTimeout(resolve, 500);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
  }

  private respondToAuthChallenge(payload: { nonce: string }) {
    const instanceKey = `pro-agent-${this.config.workspaceId}`;
    const dataDir = this.config.localDir;
    const { privateKey } = require('./keys/keys').loadOrCreateKeys(dataDir);
    const signature = signMessage(privateKey, payload.nonce);
    this.socket?.emit('auth_response', { instanceKey, signature, workspaceId: this.config.workspaceId });
  }

  onAuthChallenge(callback: (payload: { nonce: string }) => void): void {
    this._onAuthChallenge = callback;
  }

  emitAuthResponse(instanceKey: string, signature: string): void {
    this.socket?.emit('auth_response', { instanceKey, signature, workspaceId: this.config.workspaceId });
  }

  onJobPushed(callback: (job: any) => void): void {
    this._onJobPushed = callback;
  }

  async registerInstance(instanceKey: string, metadata: Record<string, any>): Promise<void> {
    const pubKeyBase64 = getPublicKeyBase64(this.config.localDir);
    const body = {
      instanceKey,
      workspaceId: metadata.workspaceId !== undefined ? metadata.workspaceId : null,
      mode: 'pro-agent',
      version: '1.0.0',
      metadata: { ...metadata, ed25519PublicKey: pubKeyBase64 },
    };
    const { privateKey } = require('./keys/keys').loadOrCreateKeys(this.config.localDir);
    const signature = signMessage(privateKey, JSON.stringify(body));

    const res = await fetch(`${this.config.nexoriaApiUrl}/runner/runtime/instances`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pro-Agent-Signature': signature,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`registerInstance ${res.status}: ${await res.text()}`);
  }

  async heartbeat(instanceKey: string, status: string): Promise<void> {
    const body = { status, metadata: { agentProfileId: this.config.agentProfileId } };
    const { privateKey } = require('./keys/keys').loadOrCreateKeys(this.config.localDir);
    const signature = signMessage(privateKey, JSON.stringify(body));
    const res = await fetch(`${this.config.nexoriaApiUrl}/runner/runtime/instances/${instanceKey}/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pro-Agent-Signature': signature,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`heartbeat ${res.status}: ${await res.text()}`);
  }

  async claimNextJob(instanceKey: string): Promise<any | null> {
    if (!this.socket?.connected) return null;
    return new Promise((resolve) => {
      this.socket!.emit('job.claim');
      this.socket!.once('job.claimed', (job: any) => resolve(job ?? null));
      setTimeout(() => resolve(null), 5000);
    });
  }

  async completeJob(instanceKey: string, jobId: string, result: any): Promise<void> {
    if (!this.socket?.connected) return;
    this.socket.emit('job.complete', { jobId, ...result });
  }

  async postEvent(instanceKey: string, jobId: string, event: any): Promise<void> {
    if (!this.socket?.connected) return;
    this.socket.emit('job.event', { jobId, ...event });
  }

  emitChatChunk(sessionId: string, jobId: string, content: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('chat.chunk', { sessionId, jobId, content });
  }

  emitChatFinal(sessionId: string, jobId: string, content: string): void {
    if (!this.socket?.connected) return;
    this.socket.emit('chat.final', { sessionId, jobId, content });
  }

  emitJobComplete(instanceKey: string, jobId: string, data: { status: string; result?: Record<string, any>; error?: string }): void {
    if (!this.socket?.connected) return;
    this.socket.emit('job.complete', { jobId, ...data });
  }

  emitJobEvent(instanceKey: string, jobId: string, data: any): void {
    if (!this.socket?.connected) return;
    this.socket.emit('job.event', { jobId, ...data });
  }

  async createTask(title: string, description: string, metadata?: Record<string, any>): Promise<any> {
    if (this.socket?.connected) {
      return new Promise((resolve, reject) => {
        this.socket!.emit('task.create', { title, description, metadata: metadata ?? {} }, (response: any) => {
          if (response) resolve(response);
          else reject(new Error('task.create failed'));
        });
      });
    }
    const res = await fetch(`${this.config.nexoriaApiUrl}/workspaces/${this.config.workspaceId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.agentToken}`,
      },
      body: JSON.stringify({ title, description, metadata: metadata ?? {} }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`createTask failed: ${res.status}`);
    return res.json();
  }

  async updateTask(taskId: string, patch: Record<string, any>): Promise<any> {
    if (this.socket?.connected) {
      return new Promise((resolve, reject) => {
        this.socket!.emit('task.update', { taskId, patch }, (response: any) => {
          if (response) resolve(response);
          else reject(new Error('task.update failed'));
        });
      });
    }
    const res = await fetch(`${this.config.nexoriaApiUrl}/workspaces/${this.config.workspaceId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.agentToken}`,
      },
      body: JSON.stringify(patch),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`updateTask failed: ${res.status}`);
    return res.json();
  }
}
