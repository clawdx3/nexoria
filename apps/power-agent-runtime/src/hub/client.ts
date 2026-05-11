import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';
import { AgentConfig, HubConnectionConfig } from '../config/types';

export type HubMessageType =
  | 'register'
  | 'register_ack'
  | 'config_update'
  | 'config_ack'
  | 'task_offer'
  | 'accept'
  | 'reject'
  | 'progress'
  | 'result'
  | 'error'
  | 'tool_call'
  | 'tool_result'
  | 'approval_request'
  | 'approval_response'
  | 'heartbeat'
  | 'heartbeat_ack'
  | 'subagent_spawn'
  | 'subagent_progress'
  | 'subagent_done';

export interface HubMessage {
  type: HubMessageType;
  id?: string;
  taskId?: string;
  subagentId?: string;
  payload?: Record<string, any>;
  timestamp?: string;
}

export interface TaskOffer {
  taskId: string;
  type: string;
  payload: Record<string, any>;
  priority: number;
  timeoutSeconds: number;
}

export interface ConfigUpdate {
  version: string;
  checksum: string;
  patch?: Partial<AgentConfig>;
  full?: AgentConfig;
}

export interface ApprovalRequest {
  approvalId: string;
  type: string;
  title: string;
  description: string;
  requestedAction: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class HubClient extends EventEmitter {
  private socket: Socket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private backoffMs: number;
  private config: HubConnectionConfig;
  private currentConfigVersion: string | null = null;
  private isShuttingDown = false;

  constructor(config: HubConnectionConfig) {
    super();
    this.config = config;
    this.backoffMs = config.reconnectMs;
  }

  async connect(): Promise<void> {
    const rawUrl = this.config.hubUrl.replace(/^ws/, 'http').replace(/\/agent-hub\/v1$/, '');
    const namespace = '/agent-hub/v1';

    console.log(`[hub] connecting to ${rawUrl}${namespace}`);

    this.socket = io(`${rawUrl}${namespace}`, {
      query: { token: this.config.token },
      extraHeaders: {
        'x-instance-key': this.config.instanceKey,
        'x-runtime-version': '0.1.0',
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: this.config.reconnectMs,
      reconnectionDelayMax: this.config.maxReconnectMs,
    });

    this.setupListeners();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Hub connection timeout'));
      }, 15000);

      this.socket!.once('connect', () => {
        clearTimeout(timeout);
        this.backoffMs = this.config.reconnectMs;
        this.startHeartbeat();
        this.sendRegister();
        console.log('[hub] connected');
        this.emit('connected');
        resolve();
      });

      this.socket!.once('connect_error', (err) => {
        clearTimeout(timeout);
        console.warn('[hub] connect error:', err.message);
        this.emit('error', err);
        reject(err);
      });
    });
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      console.warn(`[hub] disconnected: ${reason}`);
      this.cleanup();
    });

    this.socket.on('register_ack', (data: any) => {
      console.log('[hub] registered', data);
      this.emit('registered', data);
    });

    this.socket.on('config_update', (data: any) => {
      this.emit('config_update', data as ConfigUpdate);
    });

    this.socket.on('task_offer', (data: any) => {
      this.emit('task_offer', data as TaskOffer);
    });

    this.socket.on('approval_request', (data: any) => {
      this.emit('approval_request', data as ApprovalRequest);
    });

    this.socket.on('approval_response', (data: any) => {
      this.emit('approval_response', data);
    });

    this.socket.on('tool_result', (data: any) => {
      this.emit('tool_result', data);
    });

    this.socket.on('heartbeat_ack', () => {
      // no-op
    });

    this.socket.on('subagent_done', (data: any) => {
      this.emit('subagent_done', data);
    });
  }

  private sendRegister(): void {
    this.send({
      type: 'register',
      payload: {
        instanceKey: this.config.instanceKey,
        capabilities: ['shell', 'browser', 'file_system', 'code_exec', 'gpu'],
        models: ['ollama/llama3.3', 'openrouter/gpt-5.5'],
        capacity: 4,
        currentConfigVersion: this.currentConfigVersion,
      },
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.send({
        type: 'heartbeat',
        payload: {
          timestamp: new Date().toISOString(),
          cpuUsage: process.cpuUsage(),
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
        },
      });
    }, this.config.heartbeatMs);
  }

  send(msg: HubMessage): void {
    if (!this.socket || !this.socket.connected) {
      console.warn('[hub] cannot send, not connected');
      return;
    }
    this.socket.emit(msg.type, msg);
  }

  acceptTask(taskId: string): void {
    this.send({ type: 'accept', taskId });
  }

  rejectTask(taskId: string, reason: string): void {
    this.send({ type: 'reject', taskId, payload: { reason } });
  }

  sendProgress(taskId: string, data: Record<string, any>): void {
    this.send({ type: 'progress', taskId, payload: data });
  }

  sendResult(taskId: string, result: Record<string, any>): void {
    this.send({ type: 'result', taskId, payload: result });
  }

  sendError(taskId: string, error: string): void {
    this.send({ type: 'error', taskId, payload: { error } });
  }

  sendConfigAck(version: string): void {
    this.currentConfigVersion = version;
    this.send({ type: 'config_ack', payload: { version } });
  }

  requestApproval(approval: ApprovalRequest): void {
    this.send({ type: 'approval_request', payload: approval });
  }

  sendToolCall(tool: string, action: string, payload: Record<string, any>): void {
    this.send({ type: 'tool_call', payload: { tool, action, ...payload } });
  }

  sendSubagentProgress(subagentId: string, taskId: string, data: Record<string, any>): void {
    this.send({ type: 'subagent_progress', subagentId, taskId, payload: data });
  }

  sendSubagentDone(subagentId: string, taskId: string, result: Record<string, any>): void {
    this.send({ type: 'subagent_done', subagentId, taskId, payload: result });
  }

  private cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  shutdown(): void {
    this.isShuttingDown = true;
    this.cleanup();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.removeAllListeners();
  }
}