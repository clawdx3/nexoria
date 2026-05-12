import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ProAgentOrJwtGuard } from '../../common/guards/pro-agent-or-jwt.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MemoryService } from './memory.service';
import { MemoryLifecycleService } from './memory-lifecycle.service';
import { MemoryCuratorService } from './memory-curator.service';
import { MemoryOutcomeTrackerService } from './memory-outcome-tracker.service';
import { MemoryController } from './memory.controller';
import { MemoryContextBuilder } from '../agent-runtime/memory-context/memory-context.builder';
import { ReflectionService } from '../agent-runtime/reflection/reflection.service';
import { ReflectionDebouncerService } from '../agent-runtime/reflection/reflection-debouncer.service';
import { MemoryEntry } from '../../database/entities/memory-entry.entity';
import { MemoryCuratorRun } from '../../database/entities/memory-curator-run.entity';
import { RuntimeChatMessage } from '../../database/entities/runtime-chat-message.entity';
import { RuntimeChatSession } from '../../database/entities/runtime-chat-session.entity';
import { RuntimeInstance } from '../../database/entities/runtime-instance.entity';
import { EmbeddingModule } from '../embedding/embedding.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MemoryEntry, MemoryCuratorRun, RuntimeChatMessage, RuntimeChatSession, RuntimeInstance]),
    EmbeddingModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    MemoryService,
    MemoryContextBuilder,
    MemoryLifecycleService,
    MemoryCuratorService,
    MemoryOutcomeTrackerService,
    ReflectionService,
    ReflectionDebouncerService,
    ProAgentOrJwtGuard,
    JwtAuthGuard,
  ],
  controllers: [MemoryController],
  exports: [
    MemoryService,
    MemoryContextBuilder,
    MemoryLifecycleService,
    MemoryCuratorService,
    MemoryOutcomeTrackerService,
    ReflectionService,
    ReflectionDebouncerService,
    ProAgentOrJwtGuard,
    JwtAuthGuard,
  ],
})
export class MemoryModule {}
