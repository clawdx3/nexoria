import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { WorkspaceMember } from './workspace-member.entity';
import { Invitation } from './invitation.entity';
import { Project } from './project.entity';
import { AgentProfile } from './agent-profile.entity';
import { MemoryEntry } from './memory-entry.entity';
import { AuditLog } from './audit-log.entity';

export type WorkspacePlanTier = 'free' | 'lite' | 'pro' | 'enterprise';

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ type: 'enum', enum: ['free', 'lite', 'pro', 'enterprise'], default: 'free' })
  planTier: WorkspacePlanTier;

  @Column({ type: 'timestamp', nullable: true })
  planExpiresAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any>;

  @Column()
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @OneToMany(() => WorkspaceMember, (wm) => wm.workspace)
  members: WorkspaceMember[];

  @OneToMany(() => Invitation, (inv) => inv.workspace)
  invitations: Invitation[];

  @OneToMany(() => Project, (proj) => proj.workspace)
  projects: Project[];

  @OneToMany(() => AgentProfile, (ap) => ap.workspace)
  agentProfiles: AgentProfile[];

  @OneToMany(() => MemoryEntry, (mem) => mem.workspace)
  memoryEntries: MemoryEntry[];

  @OneToMany(() => AuditLog, (log) => log.workspace)
  auditLogs: AuditLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
