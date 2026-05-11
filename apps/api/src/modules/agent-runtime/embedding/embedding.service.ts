import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private embedder: FeatureExtractionPipeline | null = null;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';
  private ready = false;

  async onModuleInit(): Promise<void> {
    // Skip heavy model loading in test environments to avoid hangs / OOM
    if (process.env.NODE_ENV === 'test') {
      this.logger.log('Test environment detected; skipping embedding model load');
      return;
    }
    try {
      this.embedder = await pipeline('feature-extraction' as any, this.modelName, {
        quantized: true,
      });
      this.ready = true;
      this.logger.log(`Embedding model loaded: ${this.modelName}`);
    } catch (err: any) {
      this.logger.error(`Failed to load embedding model: ${err.message}`);
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.ready || !this.embedder) {
      throw new Error('Embedding model is not ready');
    }
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    const data = output.data as Float32Array;
    return Array.from(data);
  }

  isReady(): boolean {
    return this.ready;
  }
}
