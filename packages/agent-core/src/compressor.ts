/**
 * Context compression for long conversations.
 * Iterative summarization: keep previous summary, append new turns.
 */
export interface CompressorMessage {
  role: string;
  content: string;
}

export interface ContextCompressor {
  compress(messages: CompressorMessage[], maxTokens: number): Promise<CompressorMessage[]>;
}

export class IterativeSummarizer implements ContextCompressor {
  private summary = '';

  async compress(messages: CompressorMessage[], maxTokens: number): Promise<CompressorMessage[]> {
    // Rough estimation: 1 token ~ 4 chars
    const estimatedTokens = Math.ceil(messages.reduce((acc, m) => acc + m.content.length, 0) / 4);
    if (estimatedTokens <= maxTokens * 0.85) return messages;

    // Keep system message, summarize the rest
    const systemMessage = messages.find((m) => m.role === 'system');
    const nonSystem = messages.filter((m) => m.role !== 'system');

    // Take last 4 turns verbatim, summarize everything before
    const recent = nonSystem.slice(-4);
    const older = nonSystem.slice(0, -4);

    if (older.length > 0) {
      const olderText = older.map((m) => `[${m.role}] ${m.content}`).join('\n');
      this.summary = await this.summarize(olderText);
    }

    const compressed: CompressorMessage[] = [];
    if (systemMessage) compressed.push(systemMessage);
    if (this.summary) {
      compressed.push({ role: 'system', content: `Previous conversation summary:\n${this.summary}` });
    }
    compressed.push(...recent);
    return compressed;
  }

  reset(): void {
    this.summary = '';
  }

  private async summarize(text: string): Promise<string> {
    // Fallback simple compression: truncate with ellipsis
    if (text.length <= 800) return text;
    const half = Math.floor(400);
    return text.slice(0, half) + '\n...[truncated]...\n' + text.slice(-half);
  }
}

export function tokenEstimate(messages: CompressorMessage[]): number {
  return Math.ceil(messages.reduce((acc, m) => acc + m.content.length, 0) / 4);
}
