import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentProfilesModule } from '../agent-profiles/agent-profiles.module';
import { Artifact } from '../../database/entities/artifact.entity';
import { RuntimeEvent } from '../../database/entities/runtime-event.entity';
import { RuntimeInstance } from '../../database/entities/runtime-instance.entity';
import { RuntimeJob } from '../../database/entities/runtime-job.entity';
import { RuntimeChatSession } from '../../database/entities/runtime-chat-session.entity';
import { RuntimeChatMessage } from '../../database/entities/runtime-chat-message.entity';
import { RuntimeChatCommand } from '../../database/entities/runtime-chat-command.entity';
import { Task } from '../../database/entities/task.entity';
import { TaskComment } from '../../database/entities/task-comment.entity';
import { AttachmentsModule } from '../attachments/attachments.module';
import { MemoryModule } from '../memory/memory.module';
import { ArtifactsController, ManagedRuntimeController, RuntimeRunnerController } from './managed-runtime.controller';
import { ManagedRuntimeService } from './managed-runtime.service';
import { RunnerEventsService } from './runner-events/runner-events.service';
import { RunnerTokenGuard } from './runner-token.guard';

import { AgentRuntimeModule } from '../agent-runtime/agent-runtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RuntimeInstance, RuntimeJob, RuntimeEvent, Artifact, RuntimeChatSession, RuntimeChatMessage, RuntimeChatCommand, Task, TaskComment]),
    AgentProfilesModule,
    AttachmentsModule,
    MemoryModule,
    AgentRuntimeModule,
  ],
  providers: [ManagedRuntimeService, RunnerEventsService, RunnerTokenGuard],
  controllers: [ManagedRuntimeController, ArtifactsController, RuntimeRunnerController],
  exports: [ManagedRuntimeService, RunnerEventsService],
})
export class ManagedRuntimeModule {}
