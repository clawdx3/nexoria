import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentExecutorService } from './executor/agent-executor.service';
import { ToolRegistryService } from './tool-registry/tool-registry.service';
import { LlmProviderFactory } from './llm-provider/llm-provider.factory';
import { MemoryEntry } from '../../database/entities/memory-entry.entity';
import { RuntimeInstance } from '../../database/entities/runtime-instance.entity';
import { AgentRuntimeController } from './agent-runtime.controller';
import { AgentProfilesModule } from '../agent-profiles/agent-profiles.module';
import { BrowserModule } from '../browser/browser.module';
import { MemoryModule } from '../memory/memory.module';
import { AgentLoopService } from './loop/agent-loop.service';
import { AgentRuntimeGateway } from './gateway/agent-runtime.gateway';
import { ProAgentRunnerController } from './gateway/pro-agent-runner.controller';

import { ProAgentHttpGuard } from '../../common/guards/pro-agent-http.guard';

@Module({
  imports: [TypeOrmModule.forFeature([MemoryEntry, RuntimeInstance]), AgentProfilesModule, BrowserModule, MemoryModule],
  providers: [AgentExecutorService, AgentLoopService, ToolRegistryService, LlmProviderFactory, AgentRuntimeGateway, ProAgentHttpGuard],
  controllers: [AgentRuntimeController, ProAgentRunnerController],
  exports: [AgentExecutorService, AgentLoopService, ToolRegistryService, LlmProviderFactory, AgentRuntimeGateway],
})
export class AgentRuntimeModule {}
