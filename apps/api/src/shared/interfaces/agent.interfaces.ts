export interface AgentContext {
  workspaceId: string;
  triggeredByUserId: string;
  userRole: string;
  projectId?: string;
  autonomyLevel: number;
  agentProfile: {
    id: string;
    name: string;
    systemPrompt: string;
    modelProvider: string;
    modelName: string;
    modelConfig?: Record<string, any>;
    enabledTools: string[];
    role: string;
  };
  sessionId?: string;
  scratchpad?: Record<string, any>;
}

export interface FileStateStore {
  get(path: string): { path: string; mtime: number; hash: string } | undefined;
  set(path: string, entry: { path: string; mtime: number; hash: string }): void;
  has(path: string): boolean;
  clear(): void;
}

export interface ToolContext extends AgentContext {
  stateStore?: FileStateStore;
}

export interface AgentTool {
  name: string;
  description: string;
  schema: import('zod').ZodSchema<any>;
  riskLevel: number; // 1 = safe, 2 = moderate, 3 = high
  exclusive?: boolean; // if true, must run alone (e.g. ask_user)
  execute: (args: any, ctx: ToolContext) => Promise<any>;
}

export interface AgentExecutorResult {
  success: boolean;
  steps: AgentStep[];
  finalOutput: any;
  error?: string;
  tokensUsed: number;
  durationMs: number;
  interruptedByApprovalId?: string;
}

export interface AgentStep {
  step: number;
  thought?: string;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
  timestamp: Date;
}
