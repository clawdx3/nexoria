import WebSocket from 'ws';
import { Config } from './config';

export interface ProAgentApiClient {
  registerInstance(instanceKey: string, metadata: Record<string, any>): Promise<void>;
  heartbeat(instanceKey: string, status: string): Promise<void>;
  claimNextJob(instanceKey: string): Promise<any | null>;
  completeJob(instanceKey: string, jobId: string, result: any): Promise<void>;
  postEvent(instanceKey: string, jobId: string, event: any): Promise<void>;
  streamEvents(instanceKey: string, onEvent: (event: any) => void): () => void;
}

export class HttpProAgentApiClient implements ProAgentApiClient {
  constructor(private readonly config: Config) {}

  private async fetch(path: string, init?: any): Promise<any> {
    const url = `${this.config.nexoriaApiUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Pro-Agent-Token': this.config.agentToken,
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API ${path} ${res.status}: ${body}`);
    }
    if (res.status === 204) return null;
    return res.json().catch(() => null);
  }

  async registerInstance(instanceKey: string, metadata: Record<string, any>): Promise<void> {
    await this.fetch('/runner/runtime/instances', {
      method: 'POST',
      body: JSON.stringify({
        instanceKey,
        workspaceId: metadata.workspaceId !== undefined ? metadata.workspaceId : this.config.workspaceId,
        mode: 'pro-agent',
        version: '1.0.0',
        metadata,
      }),
    });
  }

  async heartbeat(instanceKey: string, status: string): Promise<void> {
    await this.fetch(`/runner/runtime/instances/${instanceKey}/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ status, metadata: { agentProfileId: this.config.agentProfileId } }),
    });
  }

  async claimNextJob(instanceKey: string): Promise<any | null> {
    return this.fetch(`/runner/runtime/instances/${instanceKey}/jobs/next`);
  }

  async completeJob(instanceKey: string, jobId: string, result: any): Promise<void> {
    await this.fetch(`/runner/runtime/instances/${instanceKey}/jobs/${jobId}/result`, {
      method: 'POST',
      body: JSON.stringify(result),
    });
  }

  async postEvent(instanceKey: string, jobId: string, event: any): Promise<void> {
    await this.fetch(`/runner/runtime/instances/${instanceKey}/jobs/${jobId}/events`, {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  streamEvents(instanceKey: string, onEvent: (event: any) => void): () => void {
    // Pro Agent uses HTTP polling for now; SSE stream can be added later
    const abort = new AbortController();
    const poll = async () => {
      while (!abort.signal.aborted) {
        try {
          const event = await this.fetch(`/runner/runtime/instances/${instanceKey}/events`, {
            signal: abort.signal,
          });
          if (event) onEvent(event);
        } catch {
          // ignore
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    };
    poll();
    return () => abort.abort();
  }
}
