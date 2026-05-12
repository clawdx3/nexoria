import { MemoryProvider, ToolContext } from '@nexoria/agent-core';

export class NexoriaMemoryProvider implements MemoryProvider {
  constructor(
    private readonly apiUrl: string,
    private readonly agentToken: string,
    private readonly workspaceId: string,
  ) {}

  async loadTier(ctx: ToolContext, tier: string, limit: number): Promise<string[]> {
    try {
      const params = new URLSearchParams();
      params.set('tier', tier);
      params.set('limit', String(limit));
      params.set('userId', ctx.triggeredByUserId);
      if (tier === 'session' && ctx.sessionId) {
        params.set('sessionId', ctx.sessionId);
      }
      const url = `${this.apiUrl}/workspaces/${this.workspaceId}/memory?${params.toString()}`;
      const res = await fetch(url, {
        headers: this.headers(),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data = await res.json() as any[];
      return data.map((m: any) => m.content || '').filter(Boolean);
    } catch {
      return [];
    }
  }

  async loadLongTerm(ctx: ToolContext, query: string, limit: number): Promise<string[]> {
    try {
      const url = `${this.apiUrl}/workspaces/${this.workspaceId}/memory/search`;
      const res = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ query, limit, tier: 'long_term' }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data = await res.json() as any[];
      return data.map((m: any) => m.content || '').filter(Boolean);
    } catch {
      return [];
    }
  }

  async store(ctx: ToolContext, content: string, tier: string, type: string, confidence?: number): Promise<void> {
    try {
      const url = `${this.apiUrl}/workspaces/${this.workspaceId}/memory`;
      await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          userId: ctx.triggeredByUserId,
          content,
          tier,
          type,
          confidence: confidence ?? 0.5,
          metadata: {
            source: 'pro-agent',
            agentProfileId: ctx.agentProfile.id,
            sessionId: ctx.sessionId,
          },
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // fire-and-forget
    }
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-workspace-id': this.workspaceId,
      Authorization: `Bearer ${this.agentToken}`,
    };
  }
}
