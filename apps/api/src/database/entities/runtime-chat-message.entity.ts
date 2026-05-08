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
import { RuntimeChatSession } from './runtime-chat-session.entity';

export type RuntimeChatMessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type RuntimeChatMessageStatus = 'pending' | 'streaming' | 'completed' | 'error';

@Entity('runtime_chat_messages')
export class RuntimeChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'uuid' })
  sessionId: string;

  @ManyToOne(() => RuntimeChatSession, (session: RuntimeChatSession) => session.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: RuntimeChatSession;

  @Column({ type: 'enum', enum: ['user', 'assistant', 'system', 'tool'] })
  role: RuntimeChatMessageRole;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: ['pending', 'streaming', 'completed', 'error'], default: 'completed' })
  status: RuntimeChatMessageStatus;

  @Column({ type: 'text', nullable: true })
  openclawMessageId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
