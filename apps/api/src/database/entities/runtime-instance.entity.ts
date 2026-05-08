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

export type RuntimeInstanceStatus = 'provisioning' | 'ready' | 'offline' | 'error' | 'paused' | 'destroyed';

@Entity('runtime_instances')
export class RuntimeInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  instanceKey: string;

  @Column({ type: 'uuid', nullable: true })
  workspaceId: string | null;

  @ManyToOne(() => Workspace, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace | null;

  @Column({ type: 'enum', enum: ['provisioning', 'ready', 'offline', 'error', 'paused', 'destroyed'], default: 'provisioning' })
  status: RuntimeInstanceStatus;

  @Column({ default: 'local-docker' })
  mode: string;

  @Column({ nullable: true })
  version: string;

  @Column({ nullable: true })
  gatewayUrl: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastHeartbeatAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
