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

@Entity('playbooks')
export class Playbook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb' })
  steps: Record<string, any>[];

  @Column({ type: 'jsonb', nullable: true })
  triggers: Record<string, any> | null;

  @Column({ default: false })
  isBuiltIn: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  variables: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
