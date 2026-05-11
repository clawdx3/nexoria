import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import appConfig from './config/app.config';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { MissionsModule } from './modules/missions/missions.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { AgentProfilesModule } from './modules/agent-profiles/agent-profiles.module';
import { MemoryModule } from './modules/memory/memory.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { PlaybooksModule } from './modules/playbooks/playbooks.module';
import { AuditModule } from './modules/audit/audit.module';
import { AgentRuntimeModule } from './modules/agent-runtime/agent-runtime.module';
import { BrowserModule } from './modules/browser/browser.module';
import { ManagedRuntimeModule } from './modules/managed-runtime/managed-runtime.module';
import { McpModule } from './modules/mcp/mcp.module';
import { SocialPostDraftsModule } from './modules/social-post-drafts/social-post-drafts.module';
import { SkillsModule } from './modules/skills/skills.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { AgentHubModule } from './modules/agent-hub/agent-hub.module';

import * as entities from './database/entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USER || 'nexoria',
        password: process.env.DB_PASSWORD || 'nexoria',
        database: process.env.DB_NAME || 'nexoria',
        entities: Object.values(entities),
        synchronize: config.get('app.nodeEnv') === 'development',
        logging: config.get('app.nodeEnv') === 'development',
      }),
    }),
    AuthModule,
    UsersModule,
    WorkspacesModule,
    TasksModule,
    MissionsModule,
    ApprovalsModule,
    AgentProfilesModule,
    MemoryModule,
    IntegrationsModule,
    PlaybooksModule,
    AuditModule,
    AgentRuntimeModule,
    BrowserModule,
    ManagedRuntimeModule,
    AttachmentsModule,
    McpModule,
    SkillsModule,
    SocialPostDraftsModule,
    AgentHubModule,
  ],
})
export class AppModule {}
