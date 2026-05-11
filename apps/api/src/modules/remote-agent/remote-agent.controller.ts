import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RemoteAgentService, AgentEvent } from './remote-agent.service';
import { AgentProfilesService } from '../agent-profiles/agent-profiles.service';

@ApiTags('Remote Agent')
@Controller('agents')
export class RemoteAgentController {
  constructor(
    private readonly remoteAgentService: RemoteAgentService,
    private readonly agentProfiles: AgentProfilesService,
  ) {}

  @Post(':agentId/events')
  async postEvent(
    @Param('agentId') agentId: string,
    @Headers('authorization') authHeader: string,
    @Body() event: AgentEvent,
  ): Promise<{ ok: boolean }> {
    const profile = await this.agentProfiles.findOne(agentId);
    if (!profile) throw new UnauthorizedException('Agent not found');
    // TODO: validate bearer token against profile.remoteConfig.agentToken
    await this.remoteAgentService.handleAgentEvent(agentId, event);
    return { ok: true };
  }
}
