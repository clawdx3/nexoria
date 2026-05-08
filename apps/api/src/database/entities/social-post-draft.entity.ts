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
import { Task } from './task.entity';

export type SocialPostPlatform = 'facebook' | 'instagram' | 'linkedin' | 'x' | 'generic';
export type SocialPostDraftStatus = 'draft' | 'review' | 'approved' | 'scheduled' | 'published' | 'rejected';

@Entity('social_post_drafts')
export class SocialPostDraft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'enum', enum: ['facebook', 'instagram', 'linkedin', 'x', 'generic'], default: 'facebook' })
  platform: SocialPostPlatform;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  topic: string | null;

  @Column({ type: 'text' })
  copy: string;

  @Column({ type: 'text', nullable: true })
  mediaBrief: string | null;

  @Column({ type: 'enum', enum: ['draft', 'review', 'approved', 'scheduled', 'published', 'rejected'], default: 'draft' })
  status: SocialPostDraftStatus;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledFor: Date | null;

  @Column({ type: 'uuid', nullable: true })
  taskId: string | null;

  @ManyToOne(() => Task, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'taskId' })
  task: Task | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
