import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { RuntimeJob } from './runtime-job.entity';
import { RuntimeInstance } from './runtime-instance.entity';

export type RuntimeEventLevel = 'debug' | 'info' | 'warn' | 'error';

@Entity('runtime_events')
export class RuntimeEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'uuid', nullable: true })
  jobId: string | null;

  @ManyToOne(() => RuntimeJob, (job: RuntimeJob) => job.events, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'jobId' })
  job: RuntimeJob | null;

  @Column({ type: 'uuid', nullable: true })
  instanceId: string | null;

  @ManyToOne(() => RuntimeInstance, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'instanceId' })
  instance: RuntimeInstance | null;

  @Column()
  type: string;

  @Column({ type: 'enum', enum: ['debug', 'info', 'warn', 'error'], default: 'info' })
  level: RuntimeEventLevel;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
