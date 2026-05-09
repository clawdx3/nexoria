import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { createClient, RedisClientType } from 'redis';

export interface RunnerEvent {
  type: 'job' | 'chat_command';
  data: any;
}

@Injectable()
export class RunnerEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RunnerEventsService.name);
  private publisher: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private readonly instanceStreams = new Map<string, Subject<RunnerEvent>>();

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set; runner events will fall back to HTTP polling');
      return;
    }
    try {
      this.publisher = createClient({ url: redisUrl });
      this.subscriber = createClient({ url: redisUrl });
      await this.publisher.connect();
      await this.subscriber.connect();
      await this.subscriber.subscribe('runner:events', (message) => {
        try {
          const event = JSON.parse(message) as RunnerEvent & { instanceKey: string };
          this.forwardToInstance(event.instanceKey, event);
        } catch {
          // ignore malformed messages
        }
      });
      this.logger.log('Redis runner events pub/sub connected');
    } catch (err: any) {
      this.logger.error(`Redis runner events connection failed: ${err.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.publisher?.disconnect().catch(() => {});
    await this.subscriber?.disconnect().catch(() => {});
  }

  streamFor(instanceKey: string): Observable<RunnerEvent> {
    let subject = this.instanceStreams.get(instanceKey);
    if (!subject || subject.closed) {
      subject = new Subject<RunnerEvent>();
      this.instanceStreams.set(instanceKey, subject);
    }
    return subject.asObservable();
  }

  async publish(instanceKey: string, event: RunnerEvent): Promise<void> {
    if (!this.publisher?.isReady) return;
    await this.publisher.publish('runner:events', JSON.stringify({ instanceKey, ...event }));
  }

  private forwardToInstance(instanceKey: string, event: RunnerEvent): void {
    const subject = this.instanceStreams.get(instanceKey);
    if (subject && !subject.closed) {
      subject.next(event);
    }
  }

  cleanup(): void {
    for (const [key, subject] of this.instanceStreams) {
      if (subject.closed || subject.observers.length === 0) {
        subject.complete();
        this.instanceStreams.delete(key);
      }
    }
  }
}
