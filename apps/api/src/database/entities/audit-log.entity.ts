import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'agent_run' | 'tool_call' | 'approval' | 'integration_sync' | 'other';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace | null;

  @Column()
  actorId: string;

  @Column({ type: 'enum', enum: ['create', 'update', 'delete', 'login', 'logout', 'agent_run', 'tool_call', 'approval', 'integration_sync', 'other'] })
  action: AuditAction;

  @Column()
  entityType: string;

  @Column({ nullable: true })
  entityId: string;

  @Column({ type: 'jsonb', nullable: true })
  before: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  after: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;
}
