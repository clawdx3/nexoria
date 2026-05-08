import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';

export type AttachmentScope = 'chat' | 'tasks' | 'approvals' | 'runtime-jobs' | 'drafts' | 'general';
export type AttachmentSource = 'user_upload' | 'agent_upload' | 'runtime' | 'reference';
export type AttachmentStatus = 'pending' | 'active' | 'deleted';
export type AttachmentVisibility = 'workspace' | 'private';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column({ type: 'enum', enum: ['chat', 'tasks', 'approvals', 'runtime-jobs', 'drafts', 'general'], default: 'general' })
  scope: AttachmentScope;

  @Column({ type: 'uuid', nullable: true })
  scopeId: string | null;

  @Column({ type: 'enum', enum: ['user_upload', 'agent_upload', 'runtime', 'reference'], default: 'user_upload' })
  source: AttachmentSource;

  @Column({ type: 'enum', enum: ['pending', 'active', 'deleted'], default: 'pending' })
  status: AttachmentStatus;

  @Column({ type: 'enum', enum: ['workspace', 'private'], default: 'workspace' })
  visibility: AttachmentVisibility;

  @Column({ type: 'uuid', nullable: true })
  uploadedByUserId: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByAgentProfileId: string | null;

  @Column({ type: 'uuid', nullable: true })
  runtimeJobId: string | null;

  @Column({ type: 'uuid', nullable: true })
  runtimeChatSessionId: string | null;

  @Column({ type: 'uuid', nullable: true })
  runtimeChatMessageId: string | null;

  @Column({ type: 'uuid', nullable: true })
  taskId: string | null;

  @Column({ type: 'uuid', nullable: true })
  approvalId: string | null;

  @Column({ type: 'uuid', nullable: true })
  draftId: string | null;

  @Column({ default: 's3' })
  storageProvider: string;

  @Column()
  bucket: string;

  @Column()
  storageKey: string;

  @Column()
  filename: string;

  @Column()
  mimeType: string;

  @Column()
  sizeBytes: number;

  @Column({ type: 'varchar', nullable: true })
  checksumSha256: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
