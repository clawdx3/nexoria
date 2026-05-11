import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { RemoteAgentService } from './remote-agent.service';
import { AgentProfilesService } from '../agent-profiles/agent-profiles.service';

@WebSocketGateway({ namespace: '/remote-agent', cors: { origin: '*' } })
export class AgentWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AgentWebSocketGateway.name);
  @WebSocketServer() server: Server;

  constructor(
    private readonly remoteAgentService: RemoteAgentService,
    private readonly agentProfiles: AgentProfilesService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    const agentId = client.handshake.query?.agentId as string | undefined;
    if (!token || !agentId) {
      client.disconnect(true);
      return;
    }
    const profile = await this.agentProfiles.findOne(agentId);
    if (!profile) {
      client.disconnect(true);
      return;
    }
    // TODO: validate token against profile.remoteConfig.agentToken
    client.join(agentId);
    this.logger.log(`Pro Agent connected: ${agentId} (${client.id})`);

    // Forward events to the room
    const sub = this.remoteAgentService.streamForAgent(agentId).subscribe((event) => {
      client.emit('event', event);
    });
    client.data.subscription = sub;
  }

  handleDisconnect(client: Socket): void {
    const agentId = client.handshake.query?.agentId as string | undefined;
    if (agentId) {
      this.remoteAgentService.cleanupAgent(agentId);
    }
    if (client.data?.subscription) {
      client.data.subscription.unsubscribe();
    }
    this.logger.log(`Pro Agent disconnected: ${agentId ?? client.id}`);
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(client: Socket, payload: { status?: string; metadata?: Record<string, any> }): void {
    const agentId = client.handshake.query?.agentId as string | undefined;
    this.logger.debug(`Heartbeat from ${agentId}: ${JSON.stringify(payload)}`);
    // Could persist heartbeat to database via agentProfiles update
  }

  @SubscribeMessage('agent_event')
  async handleAgentEvent(client: Socket, payload: { event: any }): Promise<void> {
    const agentId = client.handshake.query?.agentId as string | undefined;
    if (!agentId) return;
    await this.remoteAgentService.handleAgentEvent(agentId, payload.event);
    // Fan out to other listeners
    this.server.to(agentId).emit('event', payload.event);
  }
}
