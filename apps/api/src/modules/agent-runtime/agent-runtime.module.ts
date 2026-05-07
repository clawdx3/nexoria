import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentExecutorService } from './executor/agent-executor.service';
import { ToolRegistryService } from './tool-registry/tool-registry.service';
import { LlmProviderFactory } from './llm-provider/llm-provider.factory';
import { MemoryContextBuilder } from './memory-context/memory-context.builder';
import { ReflectionService } from './reflection/reflection.service';
import { MemoryEntry } from '../../database/entities/memory-entry.entity';
import { AgentRuntimeController } from './agent-runtime.controller';
import { AgentProfilesModule } from '../agent-profiles/agent-profiles.module';

@Module({
  imports: [TypeOrmModule.forFeature([MemoryEntry]), AgentProfilesModule],
  providers: [AgentExecutorService, ToolRegistryService, LlmProviderFactory, MemoryContextBuilder, ReflectionService],
  controllers: [AgentRuntimeController],
  exports: [AgentExecutorService, ToolRegistryService, LlmProviderFactory, MemoryContextBuilder, ReflectionService],
})
export class AgentRuntimeModule {}
