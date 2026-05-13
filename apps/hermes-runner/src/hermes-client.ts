import { Config } from './config';

export type HermesEvent =
  | { type: 'delta'; content: string }
  | { type: 'status'; message: string; metadata?: Record<string, any> }
  | { type: 'final'; content: string };

export class HermesClient {
  constructor(private readonly config: Config) {}

  async runChat(job: any, onEvent: (event: HermesEvent) => void, signal?: AbortSignal): Promise<string> {
    const input = job.input ?? {};
    const instructions = this.buildInstructions(job);
    const body = {
      input: input.content ?? '',
      session_id: input.chatSessionId ?? job.id,
      instructions,
      conversation_history: input.recentMessages ?? [],
      model: this.config.hermesModel || undefined,
      metadata: {
        nexoriaJobId: job.id,
        workspaceId: job.workspaceId,
        agentProfileId: job.agentProfileId,
      },
    };

    const res = await fetch(`${this.config.hermesApiUrl}/v1/runs`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw new Error(`Hermes run create failed ${res.status}: ${await res.text()}`);

    const created: any = await res.json();
    const runId = created.run_id ?? created.id;
    if (!runId) {
      const final = this.extractFinalText(created);
      if (final) return final;
      throw new Error('Hermes response did not include run_id or final output');
    }

    return this.consumeRunEvents(runId, onEvent, signal);
  }

  private async consumeRunEvents(runId: string, onEvent: (event: HermesEvent) => void, signal?: AbortSignal): Promise<string> {
    const res = await fetch(`${this.config.hermesApiUrl}/v1/runs/${encodeURIComponent(runId)}/events`, {
      headers: { Authorization: `Bearer ${this.config.hermesApiKey}` },
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`Hermes event stream failed ${res.status}: ${await res.text()}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let final = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const dataLine = frame.split('\n').find((line) => line.startsWith('data:'));
        if (!dataLine) continue;
        const raw = dataLine.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        const event = JSON.parse(raw);
        const delta = event.delta ?? event.content_delta ?? event.text_delta;
        if (typeof delta === 'string' && delta.length) {
          final += delta;
          onEvent({ type: 'delta', content: delta });
        }
        const message = event.message ?? event.status ?? event.type;
        if (message && !delta) onEvent({ type: 'status', message: String(message), metadata: event });
        const output = this.extractFinalText(event);
        if (output) final = output;
      }
    }

    return final;
  }

  private buildInstructions(job: any): string {
    const input = job.input ?? {};
    return [
      'You are Hermes running as an external Nexoria runtime provider.',
      'Nexoria is the control plane and source of truth for workspace data, tasks, approvals, chat, and durable memory.',
      'Use Nexoria MCP tools for tasks, approvals, and durable memory. Do not store customer or workspace facts in local Hermes memory.',
      this.config.nexoriaMcpToken ? `Nexoria MCP endpoint: ${this.config.nexoriaMcpUrl}` : '',
      `Workspace ID: ${job.workspaceId}`,
      input.userId ? `User ID: ${input.userId}` : '',
      input.chatSessionId ? `Chat session ID: ${input.chatSessionId}` : '',
    ].filter(Boolean).join('\n');
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.hermesApiKey}`,
    };
  }

  private extractFinalText(payload: any): string {
    return payload?.final_response ?? payload?.final ?? payload?.output_text ?? payload?.output?.text ?? payload?.result?.output ?? '';
  }
}
