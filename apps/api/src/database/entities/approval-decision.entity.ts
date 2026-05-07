import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Approval } from './approval.entity';

export type DecisionOutcome = 'approve' | 'reject' | 'request_changes' | 'escalate';

@Entity('approval_decisions')
export class ApprovalDecision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  approvalId: string;

  @ManyToOne(() => Approval, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'approvalId' })
  approval: Approval;

  @Column()
  decidedById: string;

  @Column({ type: 'enum', enum: ['approve', 'reject', 'request_changes', 'escalate'] })
  outcome: DecisionOutcome;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;
}
