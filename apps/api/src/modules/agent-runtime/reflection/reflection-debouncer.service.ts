import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ReflectionService } from './reflection.service';
import { MemoryCuratorService } from '../../memory/memory-curator.service';

const FLUSH_DELAY_MS = Number(process.env.REFLECTION_FLUSH_DELAY_MS || 30_000);
const SWEEP_INTERVAL_MS = Number(process.env.REFLECTION_SWEEP_INTERVAL_MS || 5 * 60_000);

interface PendingFlush {
  workspaceId: string;
  userId: string;
  timer: NodeJS.Timeout;
}

/**
 * Debounces per-session reflection extraction. When a chat turn completes,
 * managed-runtime calls schedule(); after FLUSH_DELAY_MS of inactivity the
 * extraction runs once over everything new since the watermark. Multi-turn
 * sessions get one extraction call instead of N.
 *
 * Also runs a periodic sweep that catches sessions that idled out without
 * a final flush (e.g. the user closed the tab).
 */
@Injectable()
export class ReflectionDebouncerService implements OnModuleDestroy {
  private readonly logger = new Logger(ReflectionDebouncerService.name);
  private readonly pending = new Map<string, PendingFlush>();
  private sweepHandle: NodeJS.Timeout | null = null;

  constructor(
    private readonly reflection: ReflectionService,
    @Optional() private readonly curator?: MemoryCuratorService,
  ) {
    if (SWEEP_INTERVAL_MS > 0) {
      this.sweepHandle = setInterval(() => void this.runSweep(), SWEEP_INTERVAL_MS);
      this.sweepHandle.unref?.();
    }
  }

  schedule(workspaceId: string, sessionId: string, userId: string): void {
    if (!sessionId || !userId) return;
    const existing = this.pending.get(sessionId);
    if (existing) clearTimeout(existing.timer);

    const timer = setTimeout(() => void this.flush(sessionId), FLUSH_DELAY_MS);
    timer.unref?.();
    this.pending.set(sessionId, { workspaceId, userId, timer });
  }

  private async flush(sessionId: string): Promise<void> {
    const job = this.pending.get(sessionId);
    if (!job) return;
    this.pending.delete(sessionId);
    try {
      await this.reflection.extractFromTranscript(job.workspaceId, sessionId, job.userId);
      if (this.curator) {
        this.curator.maybeRunCurator(job.workspaceId, job.userId).catch((err) => {
          this.logger.warn(`Curator run failed after flush: ${err.message}`);
        });
      }
    } catch (err: any) {
      this.logger.warn(`Reflection flush failed for session ${sessionId}: ${err.message}`);
    }
  }

  private async runSweep(): Promise<void> {
    try {
      await this.reflection.sweepStaleSessions();
    } catch (err: any) {
      this.logger.warn(`Reflection sweep failed: ${err.message}`);
    }
  }

  onModuleDestroy(): void {
    if (this.sweepHandle) clearInterval(this.sweepHandle);
    for (const { timer } of this.pending.values()) clearTimeout(timer);
    this.pending.clear();
  }
}
