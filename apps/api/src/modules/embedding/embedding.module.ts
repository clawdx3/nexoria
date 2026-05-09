import { Module } from '@nestjs/common';
import { EmbeddingService } from '../agent-runtime/embedding/embedding.service';

@Module({
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
