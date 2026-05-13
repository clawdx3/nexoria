import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from '../../database/entities/task.entity';
import { TaskComment } from '../../database/entities/task-comment.entity';
import { RuntimeInstance } from '../../database/entities/runtime-instance.entity';
import { AttachmentsModule } from '../attachments/attachments.module';
import { ManagedRuntimeModule } from '../managed-runtime/managed-runtime.module';
import { ProAgentOrJwtGuard } from '../../common/guards/pro-agent-or-jwt.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskComment, RuntimeInstance]), AttachmentsModule, ManagedRuntimeModule],
  providers: [TasksService, ProAgentOrJwtGuard],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
