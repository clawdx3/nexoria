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
import { RuntimeEvent } from './runtime-event.entity';
import { Artifact } from './artifact.entity';

export type RuntimeJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'rejected' | 'cancelled';
export type RuntimeJobType = 'openclaw_task' | 'create_file' | 'research' | 'browser_task' | 'native_pro_chat' | 'native_pro_task';

@Entity('runtime_jobs')
export class RuntimeJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'uuid', nullable: true })
  instanceId: string | null;

  @ManyToOne(() => RuntimeInstance, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'instanceId' })
  instance: RuntimeInstance | null;

  @Column({ type: 'uuid', nullable: true })
  requestedByUserId: string | null;

  @Column()
  agentProfileId: string;

  @Column({ type: 'enum', enum: ['openclaw_task', 'create_file', 'research', 'browser_task', 'native_pro_chat', 'native_pro_task'], default: 'openclaw_task' })
  type: RuntimeJobType;

  @Column({ type: 'enum', enum: ['queued', 'running', 'completed', 'failed', 'rejected', 'cancelled'], default: 'queued' })
  status: RuntimeJobStatus;

  @Column({ type: 'jsonb', nullable: true })
  input: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  limits: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'uuid', nullable: true })
  sessionId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @OneToMany(() => RuntimeEvent, (event: RuntimeEvent) => event.job)
  events: RuntimeEvent[];

  @OneToMany(() => Artifact, (artifact: Artifact) => artifact.job)
  artifacts: Artifact[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
