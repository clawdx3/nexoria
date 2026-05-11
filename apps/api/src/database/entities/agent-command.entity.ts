import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AgentCommandType = 'chat' | 'job';
export type AgentCommandStatus = 'queued' | 'claimed' | 'completed' | 'failed';

@Entity('agent_commands')
export class AgentCommand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  agentProfileId: string;

  @Column('uuid')
  workspaceId: string;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: ['chat', 'job'] })
  type: AgentCommandType;

  @Column({ type: 'enum', enum: ['queued', 'claimed', 'completed', 'failed'] })
  status: AgentCommandStatus;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'timestamp', nullable: true })
  claimedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
