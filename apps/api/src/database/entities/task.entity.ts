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
import { Project } from './project.entity';
import { Mission } from './mission.entity';
import { Approval } from './approval.entity';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ nullable: true })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ['pending', 'in_progress', 'done', 'cancelled'], default: 'pending' })
  status: TaskStatus;

  @Column({ type: 'enum', enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' })
  priority: TaskPriority;

  @Column({ nullable: true })
  assignedToId: string;

  @Column({ nullable: true })
  dueDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => Mission, (m) => m.parentTask)
  missions: Mission[];

  @OneToMany(() => Approval, (a) => a.task)
  approvals: Approval[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
