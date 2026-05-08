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

export type ModelProvider = 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'custom';
export type AgentRole = 'orchestrator' | 'specialist';

@Entity('agent_profiles')
export class AgentProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  workspaceId: string | null;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace | null;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text' })
  systemPrompt: string;

  @Column({ type: 'enum', enum: ['openai', 'anthropic', 'openrouter', 'ollama', 'custom'] })
  modelProvider: ModelProvider;

  @Column()
  modelName: string;

  @Column({ type: 'jsonb', nullable: true })
  modelConfig: Record<string, any> | null;

  @Column({ type: 'simple-array', default: '' })
  enabledTools: string[];

  @Column({ type: 'enum', enum: ['orchestrator', 'specialist'], default: 'specialist' })
  role: AgentRole;

  @Column({ type: 'int', default: 1 })
  defaultAutonomyLevel: number;

  @Column({ default: false })
  isBuiltIn: boolean;

  @Column({ default: true })
  isEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
