import { Injectable } from '@nestjs/common';

export interface ConnectedAgent {
  id: string;
  socketId: string;
  instanceKey: string;
  capabilities: string[];
  models: string[];
  capacity: number;
  status: 'online' | 'busy' | 'offline';
  lastHeartbeat: Date;
  configVersion: string | null;
}

export interface AgentTask {
  id: string;
  type: string;
  payload: Record<string, any>;
  status: 'pending' | 'accepted' | 'running' | 'completed' | 'failed' | 'rejected';
  agentId: string | null;
  result: Record<string, any> | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Approval {
  id: string;
  taskId: string;
  type: string;
  title: string;
  description: string;
  riskLevel: string;
  status: 'pending' | 'approved' | 'rejected';
  userDecision?: string;
  createdAt: Date;
}

@Injectable()
export class AgentHubService {
  private agents = new Map<string, ConnectedAgent>();
  private tasks = new Map<string, AgentTask>();
  private approvals = new Map<string, Approval>();

  async registerAgent(instanceKey: string, client: any): Promise<boolean> {
    this.agents.set(client.id, {
      id: instanceKey,
      socketId: client.id,
      instanceKey,
      capabilities: [],
      models: [],
      capacity: 1,
      status: 'online',
      lastHeartbeat: new Date(),
      configVersion: null,
    });
    return true;
  }

  unregisterAgent(socketId: string): void {
    const agent = this.agents.get(socketId);
    if (agent) {
      agent.status = 'offline';
      console.log(`[agent-hub] agent disconnected: ${agent.instanceKey}`);
    }
  }

  updateAgentCapabilities(socketId: string, data: any): void {
    const agent = this.agents.get(socketId);
    if (agent) {
      agent.capabilities = data.capabilities || [];
      agent.models = data.models || [];
      agent.capacity = data.capacity || 1;
    }
  }

  updateHeartbeat(socketId: string, data: any): void {
    const agent = this.agents.get(socketId);
    if (agent) {
      agent.lastHeartbeat = new Date();
      agent.status = 'online';
    }
  }

  ackConfig(socketId: string, version: string): void {
    const agent = this.agents.get(socketId);
    if (agent) {
      agent.configVersion = version;
    }
  }

  // Task management
  createTask(type: string, payload: Record<string, any>): AgentTask {
    const task: AgentTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      payload,
      status: 'pending',
      agentId: null,
      result: null,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.set(task.id, task);
    this.dispatchTask(task);
    return task;
  }

  private dispatchTask(task: AgentTask): void {
    // Find available agent with matching capabilities
    for (const [, agent] of this.agents) {
      if (agent.status === 'online' && agent.capacity > 0) {
        // TODO: Check capability match
        this.emitTaskToAgent(agent.socketId, task);
        break;
      }
    }
  }

  private emitTaskToAgent(socketId: string, task: AgentTask): void {
    // Would emit via Socket.IO - this is simplified
    console.log(`[agent-hub] dispatching task ${task.id} to agent ${socketId}`);
  }

  acceptTask(socketId: string, taskId: string): void {
    const task = this.tasks.get(taskId);
    const agent = this.agents.get(socketId);
    if (task && agent) {
      task.status = 'accepted';
      task.agentId = agent.id;
      task.updatedAt = new Date();
      agent.status = 'busy';
    }
  }

  rejectTask(socketId: string, taskId: string, reason: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'rejected';
      task.error = reason;
      task.updatedAt = new Date();
    }
    // Redispatch to another agent
  }

  updateTaskProgress(taskId: string, data: Record<string, any>): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'running';
      task.updatedAt = new Date();
      // Store progress data
    }
  }

  completeTask(taskId: string, result: Record<string, any>): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.result = result;
      task.updatedAt = new Date();

      // Free agent
      for (const [, agent] of this.agents) {
        if (agent.id === task.agentId) {
          agent.status = 'online';
        }
      }
    }
  }

  failTask(taskId: string, error: Record<string, any>): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = error.error || JSON.stringify(error);
      task.updatedAt = new Date();

      // Free agent
      for (const [, agent] of this.agents) {
        if (agent.id === task.agentId) {
          agent.status = 'online';
        }
      }
    }
  }

  // Approval management
  createApproval(data: any): Approval {
    const approval: Approval = {
      id: data.approvalId || `approval_${Date.now()}`,
      taskId: data.taskId,
      type: data.type,
      title: data.title,
      description: data.description,
      riskLevel: data.riskLevel,
      status: 'pending',
      createdAt: new Date(),
    };
    this.approvals.set(approval.id, approval);
    return approval;
  }

  resolveApproval(approvalId: string, decision: 'approved' | 'rejected', reason?: string): void {
    const approval = this.approvals.get(approvalId);
    if (approval) {
      approval.status = decision;
      approval.userDecision = reason;
      // Notify agent
    }
  }

  getApprovals(): Approval[] {
    return Array.from(this.approvals.values());
  }

  getTasks(): AgentTask[] {
    return Array.from(this.tasks.values());
  }

  getTask(id: string): AgentTask | null {
    return this.tasks.get(id) ?? null;
  }

  getAgents(): ConnectedAgent[] {
    return Array.from(this.agents.values());
  }
}
