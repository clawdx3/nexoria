import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from '../../database/entities/task.entity';
import { TaskComment } from '../../database/entities/task-comment.entity';
import { AttachmentsModule } from '../attachments/attachments.module';
import { ManagedRuntimeModule } from '../managed-runtime/managed-runtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskComment]), AttachmentsModule, ManagedRuntimeModule],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
