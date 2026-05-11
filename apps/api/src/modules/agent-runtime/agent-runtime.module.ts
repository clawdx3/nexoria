import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentExecutorService } from './executor/agent-executor.service';
import { ToolRegistryService } from './tool-registry/tool-registry.service';
import { LlmProviderFactory } from './llm-provider/llm-provider.factory';
import { MemoryEntry } from '../../database/entities/memory-entry.entity';
import { AgentRuntimeController } from './agent-runtime.controller';
import { AgentProfilesModule } from '../agent-profiles/agent-profiles.module';
import { BrowserModule } from '../browser/browser.module';
import { MemoryModule } from '../memory/memory.module';

import { AgentLoopService } from './loop/agent-loop.service';

@Module({
  imports: [TypeOrmModule.forFeature([MemoryEntry]), AgentProfilesModule, BrowserModule, MemoryModule],
  providers: [AgentExecutorService, AgentLoopService, ToolRegistryService, LlmProviderFactory],
  controllers: [AgentRuntimeController],
  exports: [AgentExecutorService, AgentLoopService, ToolRegistryService, LlmProviderFactory],
})
export class AgentRuntimeModule {}
