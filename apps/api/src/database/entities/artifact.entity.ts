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

@Entity('artifacts')
export class Artifact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'uuid', nullable: true })
  jobId: string | null;

  @ManyToOne(() => RuntimeJob, (job: RuntimeJob) => job.artifacts, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'jobId' })
  job: RuntimeJob | null;

  @Column()
  filename: string;

  @Column()
  mimeType: string;

  @Column()
  sizeBytes: number;

  @Column()
  storageKey: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
