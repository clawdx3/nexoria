import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolRegistryService } from '../agent-runtime/tool-registry/tool-registry.service';
import { Task } from '../../database/entities/task.entity';
import { TasksService } from '../tasks/tasks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task])],
  providers: [TasksService, ToolRegistryService],
  exports: [ToolRegistryService],
})
export class ToolsModule {}
