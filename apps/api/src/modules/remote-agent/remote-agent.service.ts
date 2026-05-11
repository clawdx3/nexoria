import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from 'rxjs';
import { AgentCommand, AgentCommandStatus } from '../../database/entities/agent-command.entity';
import { AgentProfile } from '../../database/entities/agent-profile.entity';

export interface AgentEvent {
  type: 'token_delta' | 'tool_call' | 'tool_result' | 'assistant_final' | 'error' | 'status';
  content?: string;
  toolName?: string;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class RemoteAgentService {
  private readonly agentStreams = new Map<string, Subject<any>>();

  constructor(
    @InjectRepository(AgentCommand) private readonly commandsRepo: Repository<AgentCommand>,
  ) {}

  streamForAgent(agentProfileId: string): Subject<any> {
    let subject = this.agentStreams.get(agentProfileId);
    if (!subject || subject.closed) {
      subject = new Subject<any>();
      this.agentStreams.set(agentProfileId, subject);
    }
    return subject;
  }

  cleanupAgent(agentProfileId: string): void {
    const subject = this.agentStreams.get(agentProfileId);
    if (subject) {
      subject.complete();
      this.agentStreams.delete(agentProfileId);
    }
  }

  async enqueueCommand(
    workspaceId: string,
    userId: string,
    agentProfile: AgentProfile,
    type: 'chat' | 'job',
    payload: Record<string, any>,
  ): Promise<AgentCommand> {
    const command = this.commandsRepo.create({
      workspaceId,
      userId,
      agentProfileId: agentProfile.id,
      type,
      status: 'queued',
      payload,
    });
    const saved = await this.commandsRepo.save(command);
    // Emit to any connected WebSocket listeners
    this.streamForAgent(agentProfile.id).next({
      type: 'command',
      data: this.commandDto(saved),
    });
    return saved;
  }

  async claimNextCommand(agentProfileId: string): Promise<AgentCommand | null> {
    // Use raw query with FOR UPDATE SKIP LOCKED for multi-agent safety
    const raw = await this.commandsRepo.query(
      `
      UPDATE agent_commands
      SET status = 'claimed', "claimedAt" = NOW()
      WHERE id = (
        SELECT id FROM agent_commands
        WHERE "agentProfileId" = $1 AND status = 'queued'
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING *
      `,
      [agentProfileId],
    );
    if (!raw || raw.length === 0) return null;
    const item = raw[0] as Partial<AgentCommand>;
    return this.commandsRepo.create(item);
  }

  async completeCommand(
    commandId: string,
    status: AgentCommandStatus,
    result?: Record<string, any>,
    error?: string,
  ): Promise<AgentCommand> {
    await this.commandsRepo.update(commandId, {
      status,
      result: result ?? null,
      error: error ?? null,
      completedAt: new Date(),
    });
    return this.commandsRepo.findOneOrFail({ where: { id: commandId } });
  }

  async handleAgentEvent(agentProfileId: string, event: AgentEvent): Promise<void> {
    const subject = this.agentStreams.get(agentProfileId);
    if (subject && !subject.closed) {
      subject.next(event);
    }
  }

  private commandDto(command: AgentCommand): Record<string, any> {
    return {
      id: command.id,
      workspaceId: command.workspaceId,
      userId: command.userId,
      agentProfileId: command.agentProfileId,
      type: command.type,
      status: command.status,
      payload: command.payload,
      result: command.result,
      error: command.error,
      claimedAt: command.claimedAt,
      completedAt: command.completedAt,
      createdAt: command.createdAt,
    };
  }
}
