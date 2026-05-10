import { EventEmitter } from 'events';
import * as cp from 'child_process';
import * as path from 'path';
import { AgentContext } from '../core/runtime';

export interface SubagentConfig {
  role: string;
  taskId: string;
  context: AgentContext;
  signal: AbortSignal;
  onProgress?: (data: Record<string, any>) => void;
}

export interface RunningSubagent {
  id: string;
  role: string;
  taskId: string;
  process: cp.ChildProcess;
  startTime: Date;
  status: 'running' | 'completed' | 'failed';
}

export class SubagentManager extends EventEmitter {
  private subagents = new Map<string, RunningSubagent>();
  private idCounter = 0;

  async spawn(config: SubagentConfig): Promise<Record<string, any>> {
    const subagentId = `subagent_${++this.idCounter}`;
    
    return new Promise((resolve, reject) => {
      const child = cp.fork(path.join(__dirname, '../../dist/subagents/worker.js'), [], {
        env: {
          ...process.env,
          SUBAGENT_ROLE: config.role,
          SUBAGENT_TASK_ID: config.taskId,
          SUBAGENT_ID: subagentId,
        },
        silent: false,
      });

      const subagent: RunningSubagent = {
        id: subagentId,
        role: config.role,
        taskId: config.taskId,
        process: child,
        startTime: new Date(),
        status: 'running',
      };

      this.subagents.set(subagentId, subagent);

      // Handle abort
      const onAbort = () => {
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 5000);
      };
      config.signal.addEventListener('abort', onAbort);

      child.on('message', (msg: any) => {
        if (msg.type === 'progress') {
          config.onProgress?.({ subagentId, ...msg.data });
        }
      });

      child.on('error', (err) => {
        config.signal.removeEventListener('abort', onAbort);
        subagent.status = 'failed';
        this.subagents.delete(subagentId);
        reject(err);
      });

      child.on('exit', (code) => {
        config.signal.removeEventListener('abort', onAbort);
        this.subagents.delete(subagentId);

        if (code === 0) {
          subagent.status = 'completed';
          resolve({ subagentId, status: 'completed' });
        } else {
          subagent.status = 'failed';
          reject(new Error(`Subagent ${subagentId} exited with code ${code}`));
        }
      });

      // Send initial task
      child.send({
        type: 'init',
        role: config.role,
        taskId: config.taskId,
        context: config.context,
        payload: config.context.metadata,
      });
    });
  }

  list(): Array<{ id: string; role: string; taskId: string; status: string }> {
    return Array.from(this.subagents.values()).map((s) => ({
      id: s.id,
      role: s.role,
      taskId: s.taskId,
      status: s.status,
    }));
  }

  async shutdown(): Promise<void> {
    for (const [, subagent] of this.subagents) {
      subagent.process.kill('SIGTERM');
    }

    // Wait up to 5 seconds for graceful shutdown
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Force kill any remaining
    for (const [, subagent] of this.subagents) {
      if (!subagent.process.killed) {
        subagent.process.kill('SIGKILL');
      }
    }

    this.subagents.clear();
  }
}
