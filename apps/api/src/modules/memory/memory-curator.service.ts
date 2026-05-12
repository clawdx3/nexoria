import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { generateText } from 'ai';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { MemoryEntry } from '../../database/entities/memory-entry.entity';
import { MemoryCuratorRun } from '../../database/entities/memory-curator-run.entity';
import { EmbeddingService } from '../agent-runtime/embedding/embedding.service';

interface CuratorAction {
  action: 'create' | 'update' | 'merge' | 'suppress';
  candidateIndex: number;
  targetMemoryId: string | null;
  reason: string;
}

interface CuratorLLMResponse {
  actions: CuratorAction[];
}

const CURATOR_COOLDOWN_DAYS = 7;
const CURATOR_SYSTEM_PROMPT = [
  'You are a memory curator. Given:',
  '- EXISTING memories for this user/workspace',
  '- NEW candidate memories extracted from recent conversations',
  '',
  'For each candidate, decide:',
  '- CREATE: genuinely new information',
  '- UPDATE: supersedes an existing memory (specify which by ID)',
  '- MERGE: should be combined with an existing memory',
  '- SUPPRESS: duplicate or lower-quality version of existing',
  '',
  'Return JSON: {"actions":[{"action":"create|update|merge|suppress","candidateIndex":0,"targetMemoryId":"uuid or null","reason":"short explanation"}]}',
].join('\n');

@Injectable()
export class MemoryCuratorService {
  private readonly logger = new Logger(MemoryCuratorService.name);

  constructor(
    @InjectRepository(MemoryEntry) private readonly memoryRepo: Repository<MemoryEntry>,
    @InjectRepository(MemoryCuratorRun) private readonly curatorRunRepo: Repository<MemoryCuratorRun>,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async maybeRunCurator(workspaceId: string, userId: string): Promise<MemoryCuratorRun | null> {
    const cutoff = new Date(Date.now() - CURATOR_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    const lastRun = await this.curatorRunRepo.findOne({
      where: { workspaceId, completedAt: LessThan(cutoff) },
      order: { completedAt: 'DESC' },
    });

    if (lastRun && lastRun.completedAt && lastRun.completedAt > cutoff) {
      return null;
    }

    return this.runCurator(workspaceId, userId);
  }

  async runCurator(workspaceId: string, userId: string): Promise<MemoryCuratorRun> {
    const run = this.curatorRunRepo.create({
      workspaceId,
      startedAt: new Date(),
    });
    await this.curatorRunRepo.save(run);

    try {
      const existing = await this.memoryRepo.find({
        where: { workspaceId, userId },
        order: { confidence: 'DESC' },
        take: 50,
      });

      const candidates = await this.memoryRepo.find({
        where: { workspaceId, userId },
        order: { createdAt: 'DESC' },
        take: 20,
      });

      const candidateSet = new Set(existing.map((m) => m.id));
      const freshCandidates = candidates.filter((c) => !candidateSet.has(c.id));

      if (freshCandidates.length === 0) {
        run.completedAt = new Date();
        run.candidatesCount = 0;
        run.summary = 'No new candidate memories to evaluate.';
        await this.curatorRunRepo.save(run);
        return run;
      }

      const actions = await this.detectConflicts(existing, freshCandidates);
      run.candidatesCount = freshCandidates.length;

      const resolved = await this.resolveConflicts(workspaceId, userId, actions, freshCandidates);
      run.actions = resolved;

      const summaryParts: string[] = [];
      const counts = { create: 0, update: 0, merge: 0, suppress: 0 };
      for (const a of resolved) {
        counts[a.action as keyof typeof counts]++;
      }
      if (counts.create) summaryParts.push(`${counts.create} created`);
      if (counts.update) summaryParts.push(`${counts.update} superseded`);
      if (counts.merge) summaryParts.push(`${counts.merge} merged`);
      if (counts.suppress) summaryParts.push(`${counts.suppress} suppressed`);
      run.summary = summaryParts.length > 0 ? summaryParts.join(', ') : 'No actions taken.';

      run.completedAt = new Date();
      await this.curatorRunRepo.save(run);
      this.logger.log(`Curator run ${run.id} completed: ${run.summary}`);
      return run;
    } catch (err: any) {
      run.error = err.message;
      run.completedAt = new Date();
      await this.curatorRunRepo.save(run);
      this.logger.error(`Curator run ${run.id} failed: ${err.message}`);
      return run;
    }
  }

  async detectConflicts(existing: MemoryEntry[], candidates: MemoryEntry[]): Promise<CuratorAction[]> {
    if (candidates.length === 0) return [];

    const existingBlock = existing
      .map((m) => `[${m.id}] (type=${m.type}, tier=${m.tier}, conf=${m.confidence.toFixed(2)}, quality=${m.qualityScore.toFixed(2)}) ${m.content}`)
      .join('\n');

    const candidateBlock = candidates
      .map((m, i) => `[${i}] (type=${m.type}, tier=${m.tier}) ${m.content}`)
      .join('\n');

    const userPrompt = [
      'EXISTING memories:',
      existingBlock || '(none)',
      '',
      'NEW candidates:',
      candidateBlock,
    ].join('\n');

    let parsed: CuratorLLMResponse;
    try {
      const model = pickExtractionModel();
      const result = await generateText({
        model: model as any,
        system: CURATOR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 1200,
        temperature: 0.1,
      });

      const text = (result.text || '').trim();
      const jsonText = stripJsonFence(text);
      parsed = JSON.parse(jsonText);
    } catch (err: any) {
      this.logger.warn(`Curator LLM failed: ${err.message}`);
      return [];
    }

    const raw = Array.isArray(parsed?.actions) ? parsed.actions : [];
    const actions: CuratorAction[] = [];
    for (const a of raw) {
      if (!a || typeof a.candidateIndex !== 'number') continue;
      if (!['create', 'update', 'merge', 'suppress'].includes(a.action)) continue;
      actions.push({
        action: a.action,
        candidateIndex: a.candidateIndex,
        targetMemoryId: a.targetMemoryId || null,
        reason: a.reason || '',
      });
    }
    return actions;
  }

  async resolveConflicts(
    workspaceId: string,
    userId: string,
    actions: CuratorAction[],
    candidates: MemoryEntry[],
  ): Promise<Array<{ action: string; memoryId: string; reason: string; targetId?: string }>> {
    const applied: Array<{ action: string; memoryId: string; reason: string; targetId?: string }> = [];

    for (const act of actions) {
      const candidate = candidates[act.candidateIndex];
      if (!candidate) continue;

      try {
        switch (act.action) {
          case 'create': {
            applied.push({ action: 'create', memoryId: candidate.id, reason: act.reason });
            break;
          }
          case 'update': {
            if (!act.targetMemoryId) break;
            await this.memoryRepo.update(act.targetMemoryId, {
              supersededBy: candidate.id,
            });
            await this.memoryRepo.update(candidate.id, {
              qualityScore: () => 'quality_score + 0.1',
            });
            applied.push({
              action: 'update',
              memoryId: candidate.id,
              reason: act.reason,
              targetId: act.targetMemoryId,
            });
            break;
          }
          case 'merge': {
            if (!act.targetMemoryId) break;
            const target = await this.memoryRepo.findOne({ where: { id: act.targetMemoryId } });
            if (target) {
              const mergedContent = `${target.content} | ${candidate.content}`;
              let embedding: number[] | null = null;
              if (this.embeddingService.isReady()) {
                try { embedding = await this.embeddingService.embed(mergedContent); } catch { /* skip */ }
              }
              await this.memoryRepo.update(act.targetMemoryId, {
                content: mergedContent,
                embedding,
                confidence: Math.min(1.0, Math.max(target.confidence, candidate.confidence)),
                qualityScore: Math.min(1.0, Math.max(target.qualityScore, candidate.qualityScore) + 0.05),
              });
              await this.memoryRepo.update(candidate.id, {
                supersededBy: act.targetMemoryId,
              });
            }
            applied.push({
              action: 'merge',
              memoryId: candidate.id,
              reason: act.reason,
              targetId: act.targetMemoryId,
            });
            break;
          }
          case 'suppress': {
            await this.memoryRepo.update(candidate.id, {
              qualityScore: Math.max(0.1, candidate.qualityScore - 0.3),
            });
            if (act.targetMemoryId) {
              await this.memoryRepo.update(candidate.id, {
                supersededBy: act.targetMemoryId,
              });
            }
            applied.push({
              action: 'suppress',
              memoryId: candidate.id,
              reason: act.reason,
              targetId: act.targetMemoryId || undefined,
            });
            break;
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed to apply curator action ${act.action} on ${candidate.id}: ${err.message}`);
      }
    }

    return applied;
  }
}

function stripJsonFence(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
}

function pickExtractionModel(): unknown {
  const explicit = (process.env.MEMORY_EXTRACTION_PROVIDER || '').toLowerCase();
  const explicitModel = process.env.MEMORY_EXTRACTION_MODEL;

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
  throw new Error('No LLM credentials configured for memory extraction (OPENAI_API_KEY / OPENROUTER_API_KEY / OLLAMA_API_KEY).');
}

function autoDetectProvider(): string {
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  if (process.env.OLLAMA_API_KEY) return 'ollama';
  return 'openai';
}
