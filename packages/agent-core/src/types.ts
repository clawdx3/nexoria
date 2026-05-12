import { z } from 'zod';
import { ContextEngine } from './context-engine';

export type ModelProvider = 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'custom';
export type AgentRole = 'orchestrator' | 'specialist';
export type RuntimeMode = 'native_saas' | 'native_pro';
export type PlanTier = 'economy' | 'pro' | 'enterprise';

export interface AgentProfile {
  id: string;
  name: string;
  systemPrompt: string;
  modelProvider: ModelProvider;
  modelName: string;
  modelConfig?: Record<string, any>;
  enabledTools: string[];
  role: AgentRole;
  defaultAutonomyLevel: number;
  runtimeMode: RuntimeMode;
}

export interface ToolContext {
  agentProfile: AgentProfile;
  workspaceId: string;
  triggeredByUserId: string;
  userRole: string;
  sessionId?: string;
  autonomyLevel: number;
  stateStore?: FileStateStore;
  scratchpad?: Record<string, any>;
}

export interface AgentTool {
  name: string;
  description: string;
  schema: z.ZodSchema<any>;
  riskLevel: number; // 1 = safe, 2 = moderate, 3 = dangerous
  exclusive?: boolean; // if true, must run alone (e.g. ask_user)
  execute: (args: any, ctx: ToolContext) => Promise<any>;
}

export class AskUserInterrupt extends Error {
  public readonly approvalId: string;
  public readonly _tag = 'AskUserInterrupt' as const;
  constructor(approvalId: string, message: string) {
    super(message);
    this.approvalId = approvalId;
    this.name = 'AskUserInterrupt';
  }
}

export interface FileReadEntry {
  path: string;
  mtime: number;
  hash: string;
}

export interface FileStateStore {
  get(path: string): FileReadEntry | undefined;
  set(path: string, entry: FileReadEntry): void;
  has(path: string): boolean;
  clear(): void;
}

export interface AgentStep {
  step: number;
  thought?: string;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
  timestamp: Date;
}

export interface AgentExecutorResult {
  success: boolean;
  steps: AgentStep[];
  finalOutput: string | null;
  error?: string;
  tokensUsed: number;
  durationMs: number;
  interruptedByApprovalId?: string;
}

export interface MemoryTierResult {
  profile: string[];
  session: string[];
  daily: string[];
  longTerm: string[];
}

export interface MemoryManager {
  prefetch(ctx: ToolContext, userMessage?: string): Promise<MemoryTierResult>;
  syncTurn(ctx: ToolContext, userMessage: string, assistantResponse: string): Promise<void>;
  formatForPrompt(memory: MemoryTierResult): string;
}

export interface StreamingChunk {
  type: 'token' | 'tool_call_start' | 'tool_call_delta' | 'tool_result' | 'final' | 'error';
  content?: string;
  toolName?: string;
  toolArgs?: any;
  result?: any;
  error?: string;
}

export interface AgentConfig {
  profile: AgentProfile;
  llm: (params: {
    system: string;
    messages: Array<{ role: string; content: string }>;
    maxTokens?: number;
    temperature?: number;
  }) => Promise<{ text: string; usage?: { totalTokens?: number } }>;
  toolRegistry: ToolRegistry;
  memoryManager: MemoryManager;
  context: ToolContext;
  maxSteps?: number;
  maxTokens?: number;
  temperature?: number;
  approvalGate?: (tool: AgentTool, args: any) => Promise<boolean>;
  emit?: (chunk: StreamingChunk) => void;
  stateStore?: FileStateStore;
  enableConcurrency?: boolean;
  enableCompaction?: boolean;
  contextEngine?: ContextEngine;
}

export interface ToolRegistry {
  register(tool: AgentTool): void;
  get(name: string): AgentTool | undefined;
  listForContext(ctx: ToolContext): AgentTool[];
  listAll(): AgentTool[];
}
