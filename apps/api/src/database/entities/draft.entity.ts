import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { Mission } from './mission.entity';
import { Approval } from './approval.entity';

export type DraftType = 'social_post' | 'email' | 'blog' | 'ad_copy' | 'image' | 'generic';

@Entity('drafts')
export class Draft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column()
  missionId: string;

  @ManyToOne(() => Mission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'missionId' })
  mission: Mission;

  @Column({ type: 'enum', enum: ['social_post', 'email', 'blog', 'ad_copy', 'image', 'generic'], default: 'generic' })
  type: DraftType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any>;

  @Column({ default: false })
  isApproved: boolean;

  @OneToOne(() => Approval, (a) => a.draft)
  approval: Approval;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
