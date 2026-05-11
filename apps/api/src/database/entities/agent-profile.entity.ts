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
export type RuntimeMode = 'openclaw' | 'native_saas' | 'native_pro';
export type PlanTier = 'economy' | 'pro' | 'enterprise';

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

  @Column({ type: 'enum', enum: ['openclaw', 'native_saas', 'native_pro'], default: 'openclaw' })
  runtimeMode: 'openclaw' | 'native_saas' | 'native_pro';

  @Column({ type: 'enum', enum: ['economy', 'pro', 'enterprise'], default: 'economy' })
  planTier: 'economy' | 'pro' | 'enterprise';

  @Column({ type: 'jsonb', default: {} })
  remoteConfig: Record<string, any>;

  @Column({ default: false })
  isBuiltIn: boolean;

  @Column({ default: true })
  isEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
