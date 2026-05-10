import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { generateText } from 'ai';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { MemoryEntry } from '../../../database/entities/memory-entry.entity';
import { RuntimeChatMessage } from '../../../database/entities/runtime-chat-message.entity';
import { RuntimeChatSession } from '../../../database/entities/runtime-chat-session.entity';
import { AgentContext, AgentExecutorResult } from '../../../shared/interfaces/agent.interfaces';
import { EmbeddingService } from '../embedding/embedding.service';

interface ExtractedMemory {
  type: 'fact' | 'preference' | 'avoidance' | 'pattern';
  tier: 'profile' | 'daily' | 'long_term';
  content: string;
  confidence: number;
}

@Injectable()
export class ReflectionService {
  private readonly logger = new Logger(ReflectionService.name);

  constructor(
    @InjectRepository(MemoryEntry) private readonly memoryRepo: Repository<MemoryEntry>,
    @InjectRepository(RuntimeChatMessage) private readonly chatMessages: Repository<RuntimeChatMessage>,
    @InjectRepository(RuntimeChatSession) private readonly chatSessions: Repository<RuntimeChatSession>,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async reflect(ctx: AgentContext, result: AgentExecutorResult): Promise<void> {
    if (!result.success) {
      await this.store(ctx, 'task_result', `Failed execution: ${result.error}`, 0.7);
      return;
    }

    const toolNames = result.steps.filter((s) => s.toolName).map((s) => s.toolName!);
    if (toolNames.length) {
      await this.store(ctx, 'pattern', `Successful tool sequence: ${toolNames.join(' -> ')}`, 0.8);
    }

    if (result.finalOutput) {
      const summary = typeof result.finalOutput === 'string' ? result.finalOutput : JSON.stringify(result.finalOutput).slice(0, 500);
      await this.store(ctx, 'task_result', `Outcome: ${summary}`, 0.9);
    }
  }

  /**
   * Extract durable memories from the persisted transcript of a chat session.
   * Reads messages newer than the session's lastReflectedMessageId watermark,
   * runs a single LLM extraction pass, writes structured memory rows.
   */
  async extractFromTranscript(workspaceId: string, sessionId: string, userId: string): Promise<number> {
    const session = await this.chatSessions.findOne({ where: { id: sessionId } });
    if (!session) return 0;

    const watermarkId = (session.metadata as any)?.lastReflectedMessageId as string | undefined;
    let watermarkAt: Date | null = null;
    if (watermarkId) {
      const m = await this.chatMessages.findOne({ where: { id: watermarkId } });
      watermarkAt = m?.createdAt ?? null;
    }

    const qb = this.chatMessages.createQueryBuilder('m')
      .where('m.sessionId = :sid', { sid: sessionId })
      .andWhere('m.role IN (:...roles)', { roles: ['user', 'assistant'] })
      .andWhere("(m.status = 'completed' OR m.status IS NULL)")
      .orderBy('m.createdAt', 'ASC')
      .limit(40);
    if (watermarkAt) qb.andWhere('m.createdAt > :wm', { wm: watermarkAt });

    const messages = await qb.getMany();
    if (messages.length < 2) return 0;

    let extracted: ExtractedMemory[] = [];
    try {
      extracted = await this.runExtractionLlm(messages);
    } catch (err: any) {
      this.logger.warn(`Reflection LLM failed for session ${sessionId}: ${err.message}`);
      return 0;
    }

    const lastMessageId = messages[messages.length - 1].id;
    if (extracted.length === 0) {
      await this.updateWatermark(session, lastMessageId);
      return 0;
    }

    const provenance = {
      source: 'reflection',
      sourceMessageRange: [messages[0].id, lastMessageId],
      sourceSessionId: sessionId,
    };

    let written = 0;
    for (const item of extracted) {
      try {
        let embedding: number[] | null = null;
        if (item.tier === 'long_term' && this.embeddingService.isReady()) {
          try { embedding = await this.embeddingService.embed(item.content); } catch { /* skip */ }
        }
        const entry = this.memoryRepo.create({
          workspaceId,
          userId,
          sessionId: item.tier === 'profile' || item.tier === 'long_term' ? null : sessionId,
          tier: item.tier,
          type: item.type,
          content: item.content,
          embedding,
          metadata: provenance,
          confidence: clamp(item.confidence, 0.1, 0.95),
        });
        await this.memoryRepo.save(entry);
        written += 1;
      } catch (err: any) {
        this.logger.warn(`Failed to persist extracted memory: ${err.message}`);
      }
    }

    await this.updateWatermark(session, lastMessageId);
    if (written) this.logger.log(`Reflection extracted ${written} memories for session ${sessionId}`);
    return written;
  }

  /**
   * Periodic sweep: find sessions with new activity since their watermark and
   * run extraction. Catches sessions that idled out without a debouncer flush.
   */
  async sweepStaleSessions(staleAfterMs = 5 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - staleAfterMs);
    const sessions = await this.chatSessions.find({
      where: { lastMessageAt: Not(IsNull()) },
      order: { lastMessageAt: 'DESC' },
      take: 50,
    });
    let total = 0;
    for (const session of sessions) {
      if (!session.userId) continue;
      if (!session.lastMessageAt || session.lastMessageAt > cutoff) continue;
      total += await this.extractFromTranscript(session.workspaceId, session.id, session.userId);
    }
    return total;
  }

  private async runExtractionLlm(messages: RuntimeChatMessage[]): Promise<ExtractedMemory[]> {
    const transcript = messages
      .map((m) => `[${m.role}] ${m.content.slice(0, 1500)}`)
      .join('\n\n');

    const system = [
      'You extract durable memory from a chat transcript between a user and AI agents.',
      'Return ONLY valid JSON, no prose, no code fences.',
      'Schema: {"memories":[{"type":"fact|preference|avoidance|pattern","tier":"profile|daily|long_term","content":"single sentence in third person","confidence":0.0-1.0}]}',
      '',
      'Tier guidance:',
      '- profile: stable facts about the user/business (name, role, industry, scale).',
      '- long_term: preferences, brand voice, recurring patterns, things to avoid.',
      '- daily: ephemeral but worth remembering for the day (deadlines, current focus).',
      '',
      'Type guidance:',
      '- fact: concrete information ("Studio Vukov sells handmade ceramics").',
      '- preference: how the user likes things ("prefers warm friendly tone").',
      '- avoidance: things to never do ("never call customers \\"folks\\"").',
      '- pattern: repeated behavior or workflow ("posts to Instagram on Mondays").',
      '',
      'Skip ephemeral chitchat, status updates, tool-call confirmations, and meta-conversation about the system itself.',
      'Prefer fewer high-signal memories over many low-signal ones. If nothing is worth remembering, return {"memories":[]}.',
    ].join('\n');

    const model = pickExtractionModel();
    const result = await generateText({
      model: model as any,
      system,
      messages: [{ role: 'user', content: transcript }],
      maxTokens: 800,
      temperature: 0.2,
    });

    const text = (result.text || '').trim();
    const jsonText = stripJsonFence(text);
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      this.logger.warn(`Reflection returned non-JSON, skipping. First 200 chars: ${text.slice(0, 200)}`);
      return [];
    }

    const items = Array.isArray(parsed?.memories) ? parsed.memories : [];
    const out: ExtractedMemory[] = [];
    for (const m of items) {
      if (!m || typeof m.content !== 'string') continue;
      const content = m.content.trim();
      if (content.length < 6 || content.length > 500) continue;
      const type = ['fact', 'preference', 'avoidance', 'pattern'].includes(m.type) ? m.type : 'fact';
      const tier = ['profile', 'daily', 'long_term'].includes(m.tier) ? m.tier : 'daily';
      const confidence = typeof m.confidence === 'number' ? m.confidence : 0.7;
      out.push({ type, tier, content, confidence });
    }
    return out;
  }

  private async updateWatermark(session: RuntimeChatSession, lastMessageId: string): Promise<void> {
    const metadata = { ...(session.metadata ?? {}), lastReflectedMessageId: lastMessageId, lastReflectedAt: new Date().toISOString() };
    await this.chatSessions.update(session.id, { metadata } as any);
  }

  private async store(ctx: AgentContext, type: string, content: string, confidence: number): Promise<void> {
    const entry = this.memoryRepo.create({
      workspaceId: ctx.workspaceId,
      userId: ctx.triggeredByUserId,
      tier: 'daily',
      type: type as any,
      content,
      confidence,
      metadata: { source: 'reflection-tool', agentProfileId: ctx.agentProfile.id, sessionId: ctx.sessionId },
    });
    await this.memoryRepo.save(entry);
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function stripJsonFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  // Fallback: find first '{' and last '}'
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}

function pickExtractionModel(): unknown {
  // Honour explicit override first.
  const explicit = (process.env.MEMORY_EXTRACTION_PROVIDER || '').toLowerCase();
  const explicitModel = process.env.MEMORY_EXTRACTION_MODEL;

  // Fall back to whichever provider has credentials configured.
  const provider = explicit || autoDetectProvider();

  if (provider === 'openrouter' && process.env.OPENROUTER_API_KEY) {
    return createOpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    })(explicitModel || 'anthropic/claude-3-haiku');
  }
  if (provider === 'ollama' && process.env.OLLAMA_API_KEY) {
    return createOpenAI({
      apiKey: process.env.OLLAMA_API_KEY,
      baseURL: process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1',
    })(explicitModel || process.env.OLLAMA_MODEL || 'gpt-oss:120b');
  }
  if (process.env.OPENAI_API_KEY) {
    return openai(explicitModel || 'gpt-4o-mini');
  }
  // Last resort: throw so the caller logs and skips this extraction pass.
  throw new Error('No LLM credentials configured for memory extraction (OPENAI_API_KEY / OPENROUTER_API_KEY / OLLAMA_API_KEY).');
}

function autoDetectProvider(): string {
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  if (process.env.OLLAMA_API_KEY) return 'ollama';
  return 'openai';
}
