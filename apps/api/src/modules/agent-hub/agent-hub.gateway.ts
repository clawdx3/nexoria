import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AgentHubService } from './agent-hub.service';

@WebSocketGateway({
  namespace: 'agent-hub/v1',
  cors: { origin: '*' },
})
export class AgentHubGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly service: AgentHubService) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.query.token as string;
    const instanceKey = client.handshake.headers['x-instance-key'] as string;
    
    if (!token || !instanceKey) {
      client.disconnect(true);
      return;
    }

    const registered = await this.service.registerAgent(instanceKey, client);
    if (!registered) {
      client.disconnect(true);
      return;
    }

    console.log(`[agent-hub] agent connected: ${instanceKey}`);
  }

  handleDisconnect(client: Socket): void {
    this.service.unregisterAgent(client.id);
  }

  @SubscribeMessage('register')
  async handleRegister(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    await this.service.updateAgentCapabilities(client.id, data);
    client.emit('register_ack', { status: 'ok', agentId: client.id });
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@MessageBody() data: any, @ConnectedSocket() client: Socket): void {
    this.service.updateHeartbeat(client.id, data);
    client.emit('heartbeat_ack', { timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('accept')
  handleAccept(@MessageBody() data: { taskId: string }, @ConnectedSocket() client: Socket): void {
    this.service.acceptTask(client.id, data.taskId);
  }

  @SubscribeMessage('reject')
  handleReject(@MessageBody() data: { taskId: string; reason: string }, @ConnectedSocket() client: Socket): void {
    this.service.rejectTask(client.id, data.taskId, data.reason);
  }

  @SubscribeMessage('progress')
  handleProgress(@MessageBody() data: { taskId: string; payload: any }, @ConnectedSocket() client: Socket): void {
    this.service.updateTaskProgress(data.taskId, data.payload);
  }

  @SubscribeMessage('result')
  handleResult(@MessageBody() data: { taskId: string; payload: any }, @ConnectedSocket() client: Socket): void {
    this.service.completeTask(data.taskId, data.payload);
  }

  @SubscribeMessage('error')
  handleError(@MessageBody() data: { taskId: string; payload: any }, @ConnectedSocket() client: Socket): void {
    this.service.failTask(data.taskId, data.payload);
  }

  @SubscribeMessage('approval_request')
  handleApprovalRequest(@MessageBody() data: any, @ConnectedSocket() client: Socket): void {
    this.service.createApproval(data);
  }

  @SubscribeMessage('config_ack')
  handleConfigAck(@MessageBody() data: { version: string }, @ConnectedSocket() client: Socket): void {
    this.service.ackConfig(client.id, data.version);
  }
}
