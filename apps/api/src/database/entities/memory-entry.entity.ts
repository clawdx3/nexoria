import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Workspace } from './workspace.entity';

export type MemoryTier = 'profile' | 'session' | 'daily' | 'long_term';
export type MemoryType = 'fact' | 'preference' | 'avoidance' | 'pattern' | 'task_result' | 'draft' | 'conversation';

@Entity('memory_entries')
export class MemoryEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column()
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  sessionId: string | null;

  @Column({ type: 'enum', enum: ['profile', 'session', 'daily', 'long_term'] })
  @Index()
  tier: MemoryTier;

  @Column({ type: 'enum', enum: ['fact', 'preference', 'avoidance', 'pattern', 'task_result', 'draft', 'conversation'] })
  type: MemoryType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'float', array: true, nullable: true })
  embedding: number[] | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'float', default: 1.0 })
  confidence: number;

  @Column({ type: 'int', default: 0 })
  positiveUses: number;

  @Column({ type: 'int', default: 0 })
  negativeUses: number;

  @Column({ type: 'timestamp', nullable: true })
  lastValidatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;
}
