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

export type IntegrationType = 'facebook' | 'instagram' | 'gmail' | 'mailerlite' | 'shopify' | 'woocommerce' | 'mailchimp' | 'stripe' | 'custom';
export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'refreshing' | 'pending_selection';

@Entity('integrations')
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'enum', enum: ['facebook', 'instagram', 'gmail', 'mailerlite', 'shopify', 'woocommerce', 'mailchimp', 'stripe', 'custom'] })
  type: IntegrationType;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: ['connected', 'disconnected', 'error', 'refreshing'], default: 'disconnected' })
  status: IntegrationStatus;

  @Column({ type: 'jsonb', nullable: true })
  credentials: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
