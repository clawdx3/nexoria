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

export type VpsProvider = 'hetzner' | 'digitalocean';
export type VpsStatus = 'provisioning' | 'running' | 'stopping' | 'stopped' | 'destroying' | 'error';

@Entity('vps_instances')
export class VpsInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'enum', enum: ['hetzner', 'digitalocean'] })
  provider: VpsProvider;

  @Column()
  providerInstanceId: string;

  @Column()
  region: string;

  @Column()
  size: string;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ type: 'enum', enum: ['provisioning', 'running', 'stopping', 'stopped', 'destroying', 'error'], default: 'provisioning' })
  status: VpsStatus;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  costPerHour: number;

  @Column({ type: 'decimal', precision: 12, scale: 4, default: 0 })
  totalCost: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
