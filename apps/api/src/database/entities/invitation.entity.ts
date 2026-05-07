import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column()
  email: string;

  @Column({ type: 'enum', enum: ['owner', 'admin', 'member', 'viewer'] })
  role: string;

  @Column()
  invitedById: string;

  @Column({ type: 'enum', enum: ['pending', 'accepted', 'declined', 'expired'], default: 'pending' })
  status: InvitationStatus;

  @Column({ nullable: true })
  acceptedById: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
