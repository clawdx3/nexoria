import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RemoteAgentController } from './remote-agent.controller';
import { RemoteAgentService } from './remote-agent.service';
import { AgentWebSocketGateway } from './agent-websocket.gateway';
import { AgentCommand } from '../../database/entities/agent-command.entity';
import { AgentProfilesModule } from '../agent-profiles/agent-profiles.module';

@Module({
  imports: [TypeOrmModule.forFeature([AgentCommand]), AgentProfilesModule],
  controllers: [RemoteAgentController],
  providers: [RemoteAgentService, AgentWebSocketGateway],
  exports: [RemoteAgentService],
})
export class RemoteAgentModule {}
