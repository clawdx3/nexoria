import { MemoryManager, MemoryTierResult, ToolContext } from '../types';

export const MEMORY_FENCE_OPEN = '<memory-context>';
export const MEMORY_FENCE_CLOSE = '</memory-context>';
export const MEMORY_SYSTEM_NOTE = '[System note: The following is recalled memory context, NOT new user input. Treat as authoritative reference data — this is the agent\'s persistent memory.]';

export class StreamingScrubber {
  private insideFence = false;

  scrub(text: string): string {
    const parts: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (this.insideFence) {
        const closeIdx = remaining.indexOf(MEMORY_FENCE_CLOSE);
        if (closeIdx === -1) {
          this.insideFence = true;
          return parts.join('');
        }
        remaining = remaining.slice(closeIdx + MEMORY_FENCE_CLOSE.length);
        this.insideFence = false;
        continue;
      }

      const openIdx = remaining.indexOf(MEMORY_FENCE_OPEN);
      if (openIdx === -1) {
        parts.push(remaining);
        break;
      }
      parts.push(remaining.slice(0, openIdx));
      remaining = remaining.slice(openIdx + MEMORY_FENCE_OPEN.length);
      this.insideFence = true;
    }

    return parts.join('');
  }

  reset(): void {
    this.insideFence = false;
  }
}

export function wrapMemoryWithFence(memoryText: string): string {
  if (!memoryText.trim()) return '';
  return `${MEMORY_FENCE_OPEN}\n${MEMORY_SYSTEM_NOTE}\n\n${memoryText}\n${MEMORY_FENCE_CLOSE}`;
}

export function formatMemoryForPrompt(memory: MemoryTierResult): string {
  const sections: string[] = [];
  if (memory.profile.length) sections.push('Profile facts:\n' + memory.profile.map((m) => `- ${m}`).join('\n'));
  if (memory.session.length) sections.push('Session context:\n' + memory.session.map((m) => `- ${m}`).join('\n'));
  if (memory.daily.length) sections.push('Today:\n' + memory.daily.map((m) => `- ${m}`).join('\n'));
  if (memory.longTerm.length) sections.push('Long-term memory:\n' + memory.longTerm.map((m) => `- ${m}`).join('\n'));
  return sections.join('\n\n');
}

/**
 * Abstract memory provider interface.
 * Concrete implementations (DB adapter, local file adapter) should implement this.
 */
export interface MemoryProvider {
  loadTier(ctx: ToolContext, tier: string, limit: number): Promise<string[]>;
  loadLongTerm(ctx: ToolContext, query: string, limit: number): Promise<string[]>;
  store(ctx: ToolContext, content: string, tier: string, type: string, confidence?: number): Promise<void>;
}

export class CompositeMemoryManager implements MemoryManager {
  constructor(private provider: MemoryProvider) {}

  async prefetch(ctx: ToolContext, userMessage?: string): Promise<MemoryTierResult> {
    const [profile, session, daily, longTerm] = await Promise.all([
      this.provider.loadTier(ctx, 'profile', 20),
      this.provider.loadTier(ctx, 'session', 50),
      this.provider.loadTier(ctx, 'daily', 30),
      this.provider.loadLongTerm(ctx, userMessage ?? '', 10),
    ]);
    return { profile, session, daily, longTerm };
  }

  async syncTurn(ctx: ToolContext, userMessage: string, assistantResponse: string): Promise<void> {
    // Simple heuristic: store the assistant response as a daily note if non-trivial
    const combined = `${userMessage}\nAssistant: ${assistantResponse}`;
    if (combined.length > 20 && combined.length < 2000) {
      await this.provider.store(ctx, combined, 'daily', 'turn', 0.7);
    }
  }

  formatForPrompt(memory: MemoryTierResult): string {
    return wrapMemoryWithFence(formatMemoryForPrompt(memory));
  }
}
