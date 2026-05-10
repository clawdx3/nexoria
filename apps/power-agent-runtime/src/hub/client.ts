import WebSocket from 'ws';
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
  private ws: WebSocket | null = null;
  private connecting: Promise<void> | null = null;
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
    if (this.connecting) return this.connecting;
    this.connecting = this.doConnect();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.config.hubUrl}?token=${encodeURIComponent(this.config.token)}`;
      console.log(`[hub] connecting to ${this.config.hubUrl}`);

      const ws = new WebSocket(url, {
        headers: {
          'x-instance-key': this.config.instanceKey,
          'x-runtime-version': '0.1.0',
        },
      });

      this.ws = ws;

      const connectTimeout = setTimeout(() => {
        ws.close();
        reject(new Error('Hub connection timeout'));
      }, 15000);

      ws.on('open', () => {
        clearTimeout(connectTimeout);
        this.backoffMs = this.config.reconnectMs;
        this.startHeartbeat();
        this.sendRegister();
        console.log('[hub] connected');
        this.emit('connected');
        resolve();
      });

      ws.on('message', (data) => {
        try {
          const msg: HubMessage = JSON.parse(data.toString());
          this.handleMessage(msg);
        } catch (err) {
          console.warn('[hub] invalid message', err);
        }
      });

      ws.on('error', (err) => {
        clearTimeout(connectTimeout);
        console.warn('[hub] error', err.message);
        this.emit('error', err);
        if (ws.readyState !== WebSocket.OPEN) {
          reject(err);
        }
      });

      ws.on('close', (code, reason) => {
        console.warn(`[hub] closed code=${code} reason=${reason}`);
        this.cleanup();
        if (!this.isShuttingDown) {
          this.scheduleReconnect();
        }
      });
    });
  }

  private handleMessage(msg: HubMessage): void {
    switch (msg.type) {
      case 'register_ack':
        console.log('[hub] registered', msg.payload);
        this.emit('registered', msg.payload);
        break;

      case 'config_update':
        this.emit('config_update', msg.payload as ConfigUpdate);
        break;

      case 'task_offer':
        this.emit('task_offer', msg.payload as TaskOffer);
        break;

      case 'approval_request':
        this.emit('approval_request', msg.payload as ApprovalRequest);
        break;

      case 'approval_response':
        this.emit('approval_response', msg.payload);
        break;

      case 'tool_result':
        this.emit('tool_result', msg.payload);
        break;

      case 'heartbeat_ack':
        // no-op
        break;

      case 'subagent_done':
        this.emit('subagent_done', msg.payload);
        break;

      default:
        console.debug('[hub] unhandled message type', msg.type);
    }
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

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(this.backoffMs, this.config.maxReconnectMs);
    console.log(`[hub] reconnecting in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.backoffMs = Math.min(this.backoffMs * 2, this.config.maxReconnectMs);
      this.connect().catch((err) => {
        console.error('[hub] reconnect failed', err.message);
      });
    }, delay);
  }

  send(msg: HubMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[hub] cannot send, not connected');
      return;
    }
    this.ws.send(JSON.stringify(msg));
  }

  // Convenience methods
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
    this.ws = null;
  }

  shutdown(): void {
    this.isShuttingDown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'shutdown');
      this.ws = null;
    }
    this.cleanup();
    this.removeAllListeners();
  }
}
