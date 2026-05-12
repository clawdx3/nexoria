import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentProfilesModule } from '../agent-profiles/agent-profiles.module';
import { Artifact } from '../../database/entities/artifact.entity';
import { RuntimeEvent } from '../../database/entities/runtime-event.entity';
import { RuntimeInstance } from '../../database/entities/runtime-instance.entity';
import { RuntimeJob } from '../../database/entities/runtime-job.entity';
import { RuntimeChatSession } from '../../database/entities/runtime-chat-session.entity';
import { RuntimeChatMessage } from '../../database/entities/runtime-chat-message.entity';
import { Task } from '../../database/entities/task.entity';
import { TaskComment } from '../../database/entities/task-comment.entity';
import { AttachmentsModule } from '../attachments/attachments.module';
import { MemoryModule } from '../memory/memory.module';
import { ArtifactsController, ManagedRuntimeController } from './managed-runtime.controller';
import { ManagedRuntimeService } from './managed-runtime.service';
import { AgentRuntimeModule } from '../agent-runtime/agent-runtime.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RuntimeInstance, RuntimeJob, RuntimeEvent, Artifact, RuntimeChatSession, RuntimeChatMessage, Task, TaskComment]),
    AgentProfilesModule,
    AttachmentsModule,
    MemoryModule,
    AgentRuntimeModule,
    BillingModule,
  ],
  providers: [ManagedRuntimeService],
  controllers: [ManagedRuntimeController, ArtifactsController],
  exports: [ManagedRuntimeService],
})
export class ManagedRuntimeModule {}
