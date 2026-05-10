import { Module } from '@nestjs/common';
import { AgentHubGateway } from './agent-hub.gateway';
import { AgentHubService } from './agent-hub.service';
import { AgentHubController } from './agent-hub.controller';

@Module({
  providers: [AgentHubGateway, AgentHubService],
  controllers: [AgentHubController],
  exports: [AgentHubService],
})
export class AgentHubModule {}
