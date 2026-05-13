import { Socket, io } from 'socket.io-client';
import { Config } from './config';
import { getPublicKeyBase64, loadOrCreateKeys, signMessage } from './keys/keys';

export class NexoriaRunnerClient {
  private socket: Socket | null = null;
  private onJobPushedHandler: ((job: any) => void) | null = null;

  constructor(private readonly config: Config) {}

  async registerInstance(instanceKey: string): Promise<void> {
    const body = {
      instanceKey,
      workspaceId: this.config.workspaceId,
      mode: 'hermes',
      version: '0.1.0',
      metadata: {
        provider: 'hermes',
        agentProfileId: this.config.agentProfileId || undefined,
        hermesApiUrl: this.config.hermesApiUrl,
        ed25519PublicKey: getPublicKeyBase64(this.config.localDir),
      },
    };
    const { privateKey } = loadOrCreateKeys(this.config.localDir);
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

  async connect(instanceKey: string): Promise<void> {
    const wsUrl = this.config.nexoriaApiUrl.replace('/api/v1', '') + '/agent-runtime';
    this.socket = io(wsUrl, { transports: ['websocket'] });
    this.socket.on('job.pushed', (job: any) => this.onJobPushedHandler?.(job));
    this.socket.on('error', (err: any) => console.error('[Nexoria WS] error:', err));
    await new Promise<void>((resolve, reject) => {
      let resolved = false;
      const resolveOnce = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };
      this.socket!.once('auth_challenge', (payload: { nonce: string }) => {
        const { privateKey } = loadOrCreateKeys(this.config.localDir);
        this.socket?.emit('auth_response', {
          instanceKey,
          signature: signMessage(privateKey, payload.nonce),
          workspaceId: this.config.workspaceId,
        });
        setTimeout(resolveOnce, 250);
      });
      this.socket!.once('connect_error', reject);
      setTimeout(resolveOnce, 5000);
    });
  }

  async heartbeat(instanceKey: string, status = 'ready'): Promise<void> {
    const body = { status, metadata: { provider: 'hermes', agentProfileId: this.config.agentProfileId || undefined } };
    const { privateKey } = loadOrCreateKeys(this.config.localDir);
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

  onJobPushed(callback: (job: any) => void): void {
    this.onJobPushedHandler = callback;
  }

  async claimNextJob(): Promise<any | null> {
    if (!this.socket?.connected) return null;
    return new Promise((resolve) => {
      this.socket!.emit('job.claim');
      this.socket!.once('job.claimed', (job: any) => resolve(job ?? null));
      setTimeout(() => resolve(null), 5000);
    });
  }

  emitChatChunk(sessionId: string, jobId: string, content: string): void {
    this.socket?.emit('chat.chunk', { sessionId, jobId, content });
  }

  emitChatFinal(sessionId: string, jobId: string, content: string): void {
    this.socket?.emit('chat.final', { sessionId, jobId, content });
  }

  emitJobEvent(jobId: string, data: any): void {
    this.socket?.emit('job.event', { jobId, ...data });
  }

  emitJobComplete(jobId: string, data: { status: string; result?: Record<string, any>; error?: string }): void {
    this.socket?.emit('job.complete', { jobId, ...data });
  }
}
