import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentExecutorService } from './executor/agent-executor.service';
import { ToolRegistryService } from './tool-registry/tool-registry.service';
import { LlmProviderFactory } from './llm-provider/llm-provider.factory';
import { MemoryEntry } from '../../database/entities/memory-entry.entity';
import { AgentRuntimeController } from './agent-runtime.controller';
import { AgentProfilesModule } from '../agent-profiles/agent-profiles.module';
import { TasksModule } from '../tasks/tasks.module';
import { BrowserModule } from '../browser/browser.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [TypeOrmModule.forFeature([MemoryEntry]), AgentProfilesModule, TasksModule, BrowserModule, MemoryModule],
  providers: [AgentExecutorService, ToolRegistryService, LlmProviderFactory],
  controllers: [AgentRuntimeController],
  exports: [AgentExecutorService, ToolRegistryService, LlmProviderFactory],
})
export class AgentRuntimeModule {}
