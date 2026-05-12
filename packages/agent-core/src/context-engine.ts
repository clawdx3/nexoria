import { CompressorMessage } from './compressor';

export interface ContextEngine {
  shouldCompact(messages: CompressorMessage[], contextTokenBudget: number): boolean;
  compact(messages: CompressorMessage[], contextTokenBudget: number, focusTopic?: string): void;
  updateFromResponse(usage: { totalTokens?: number }): void;
  onSessionStart(sessionId: string): void;
  onSessionEnd(sessionId: string): void;
}

export class DefaultCompactionEngine implements ContextEngine {
  private lastTotalTokens = 0;
  private compressionCount = 0;

  shouldCompact(messages: CompressorMessage[], contextTokenBudget: number): boolean {
    const est = Math.ceil(messages.reduce((acc, m) => acc + m.content.length, 0) / 4);
    return est > contextTokenBudget * 0.85;
  }

  compact(messages: CompressorMessage[], contextTokenBudget: number): void {
    const system = messages.find((m) => m.role === 'system');
    const nonSystem = messages.filter((m) => m.role !== 'system');
    const recent = nonSystem.slice(-4);
    const older = nonSystem.slice(0, -4);
    const compactedOlder = older.map((m) => {
      if (m.role === 'user' && (m.content.startsWith('Tool result:') || m.content.startsWith('Tool results:'))) {
        const lines = m.content.split('\n');
        return { role: m.role, content: `${lines[0]}\n[result omitted]` };
      }
      return m;
    });
    messages.length = 0;
    if (system) messages.push(system);
    messages.push(...compactedOlder, ...recent);
    this.compressionCount++;
  }

  updateFromResponse(usage: { totalTokens?: number }): void {
    this.lastTotalTokens = usage?.totalTokens ?? 0;
  }

  onSessionStart(_sessionId: string): void {
    this.compressionCount = 0;
    this.lastTotalTokens = 0;
  }

  onSessionEnd(_sessionId: string): void {}
}
