import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { Task } from './task.entity';
import { Mission } from './mission.entity';
import { Draft } from './draft.entity';
import { ApprovalDecision } from './approval-decision.entity';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated';
export type ApprovalType = 'draft' | 'task' | 'autonomy_action' | 'spend';

@Entity('approvals')
export class Approval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'enum', enum: ['draft', 'task', 'autonomy_action', 'spend'] })
  type: ApprovalType;

  @Column({ type: 'enum', enum: ['pending', 'approved', 'rejected', 'escalated'], default: 'pending' })
  status: ApprovalStatus;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  taskId: string;

  @ManyToOne(() => Task, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column({ nullable: true })
  missionId: string;

  @ManyToOne(() => Mission, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'missionId' })
  mission: Mission;

  @Column({ nullable: true })
  draftId: string;

  @OneToOne(() => Draft, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'draftId' })
  draft: Draft;

  @Column({ type: 'jsonb', nullable: true })
  requestedChanges: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => ApprovalDecision, (dec) => dec.approval)
  decisions: ApprovalDecision[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
