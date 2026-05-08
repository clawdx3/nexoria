import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TasksModule } from '../tasks/tasks.module';
import { SocialPostDraftsModule } from '../social-post-drafts/social-post-drafts.module';
import { ManagedRuntimeModule } from '../managed-runtime/managed-runtime.module';
import { AgentProfilesModule } from '../agent-profiles/agent-profiles.module';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';

@Module({
  imports: [ConfigModule, TasksModule, SocialPostDraftsModule, ManagedRuntimeModule, AgentProfilesModule],
  controllers: [McpController],
  providers: [McpService],
})
export class McpModule {}
