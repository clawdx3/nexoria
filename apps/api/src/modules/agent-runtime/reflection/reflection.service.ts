import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryEntry } from '../../../database/entities/memory-entry.entity';
import { AgentContext, AgentExecutorResult } from '../../../shared/interfaces/agent.interfaces';

@Injectable()
export class ReflectionService {
  constructor(@InjectRepository(MemoryEntry) private readonly memoryRepo: Repository<MemoryEntry>) {}

  async reflect(ctx: AgentContext, result: AgentExecutorResult): Promise<void> {
    if (!result.success) {
      await this.store(ctx, 'task_result', `Failed execution: ${result.error}`, 0.7);
      return;
    }

    // Extract patterns from tool calls
    const toolNames = result.steps.filter((s) => s.toolName).map((s) => s.toolName!);
    if (toolNames.length) {
      await this.store(ctx, 'pattern', `Successful tool sequence: ${toolNames.join(' -> ')}`, 0.8);
    }

    // Store final output summary if available
    if (result.finalOutput) {
      const summary = typeof result.finalOutput === 'string' ? result.finalOutput : JSON.stringify(result.finalOutput).slice(0, 500);
      await this.store(ctx, 'task_result', `Outcome: ${summary}`, 0.9);
    }
  }

  private async store(ctx: AgentContext, type: string, content: string, confidence: number): Promise<void> {
    const entry = this.memoryRepo.create({
      workspaceId: ctx.workspaceId,
      userId: ctx.triggeredByUserId,
      tier: 'daily',
      type: type as any,
      content,
      confidence,
      metadata: { agentProfileId: ctx.agentProfile.id, sessionId: ctx.sessionId },
    });
    await this.memoryRepo.save(entry);
  }
}
