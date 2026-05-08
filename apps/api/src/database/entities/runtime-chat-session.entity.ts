import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { RuntimeInstance } from './runtime-instance.entity';
import { RuntimeChatMessage } from './runtime-chat-message.entity';
import { RuntimeChatCommand } from './runtime-chat-command.entity';

export type RuntimeChatSessionStatus = 'pending' | 'active' | 'closed' | 'error';

@Entity('runtime_chat_sessions')
export class RuntimeChatSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column()
  agentProfileId: string;

  @Column({ type: 'uuid', nullable: true })
  instanceId: string | null;

  @ManyToOne(() => RuntimeInstance, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'instanceId' })
  instance: RuntimeInstance | null;

  @Column({ type: 'text', nullable: true })
  openclawSessionKey: string | null;

  @Column({ type: 'text', nullable: true })
  openclawSessionId: string | null;

  @Column({ type: 'enum', enum: ['pending', 'active', 'closed', 'error'], default: 'pending' })
  status: RuntimeChatSessionStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @OneToMany(() => RuntimeChatMessage, (message: RuntimeChatMessage) => message.session)
  messages: RuntimeChatMessage[];

  @OneToMany(() => RuntimeChatCommand, (command: RuntimeChatCommand) => command.session)
  commands: RuntimeChatCommand[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
