import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { RuntimeInstance } from './runtime-instance.entity';
import { RuntimeChatSession } from './runtime-chat-session.entity';

export type RuntimeChatCommandType = 'start_session' | 'send_message' | 'abort_session' | 'sync_policy';
export type RuntimeChatCommandStatus = 'queued' | 'claimed' | 'completed' | 'failed' | 'cancelled';

@Entity('runtime_chat_commands')
export class RuntimeChatCommand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => RuntimeChatSession, (session: RuntimeChatSession) => session.commands, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: RuntimeChatSession;

  @Column({ type: 'uuid', nullable: true })
  instanceId: string | null;

  @ManyToOne(() => RuntimeInstance, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'instanceId' })
  instance: RuntimeInstance | null;

  @Column({ type: 'enum', enum: ['start_session', 'send_message', 'abort_session', 'sync_policy'] })
  type: RuntimeChatCommandType;

  @Column({ type: 'enum', enum: ['queued', 'claimed', 'completed', 'failed', 'cancelled'], default: 'queued' })
  status: RuntimeChatCommandStatus;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  claimedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
