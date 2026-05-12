import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Workspace } from './workspace.entity';

@Entity('workspace_usage')
@Unique(['workspaceId', 'date'])
export class WorkspaceUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 0 })
  messagesSent: number;

  @Column({ type: 'int', default: 0 })
  agentRuntimeMinutes: number;

  @Column({ type: 'decimal', default: 0 })
  vpsHours: number;

  @Column({ type: 'int', default: 0 })
  tokensUsed: number;

  @Column({ type: 'int', default: 0 })
  toolInvocations: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
