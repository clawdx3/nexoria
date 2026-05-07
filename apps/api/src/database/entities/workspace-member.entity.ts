import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { User } from './user.entity';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

@Entity('workspace_members')
export class WorkspaceMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: ['owner', 'admin', 'member', 'viewer'] })
  role: WorkspaceRole;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  joinedAt: Date;
}
