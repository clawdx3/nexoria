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
import { Task } from './task.entity';
import { Draft } from './draft.entity';
import { Approval } from './approval.entity';

export type MissionStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

@Entity('missions')
export class Mission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ['queued', 'running', 'paused', 'completed', 'failed', 'cancelled'], default: 'queued' })
  status: MissionStatus;

  @Column({ nullable: true })
  parentTaskId: string;

  @ManyToOne(() => Task, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parentTaskId' })
  parentTask: Task;

  @Column({ type: 'jsonb', nullable: true })
  playbookSnapshot: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @OneToMany(() => Draft, (d) => d.mission)
  drafts: Draft[];

  @OneToMany(() => Approval, (a) => a.mission)
  approvals: Approval[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
