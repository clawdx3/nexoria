import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { MemoryService } from './memory.service';
import { MemoryLifecycleService } from './memory-lifecycle.service';
import { MemoryController } from './memory.controller';
import { MemoryContextBuilder } from '../agent-runtime/memory-context/memory-context.builder';
import { ReflectionService } from '../agent-runtime/reflection/reflection.service';
import { ReflectionDebouncerService } from '../agent-runtime/reflection/reflection-debouncer.service';
import { MemoryEntry } from '../../database/entities/memory-entry.entity';
import { RuntimeChatMessage } from '../../database/entities/runtime-chat-message.entity';
import { RuntimeChatSession } from '../../database/entities/runtime-chat-session.entity';
import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MemoryEntry, RuntimeChatMessage, RuntimeChatSession]),
    EmbeddingModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    MemoryService,
    MemoryContextBuilder,
    MemoryLifecycleService,
    ReflectionService,
    ReflectionDebouncerService,
  ],
  controllers: [MemoryController],
  exports: [
    MemoryService,
    MemoryContextBuilder,
    MemoryLifecycleService,
    ReflectionService,
    ReflectionDebouncerService,
  ],
})
export class MemoryModule {}
