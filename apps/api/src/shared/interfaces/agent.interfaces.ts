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
}

export interface ToolContext extends AgentContext {
  // Additional tool-specific context overrides can go here
}

export interface AgentTool {
  name: string;
  description: string;
  schema: import('zod').ZodSchema<any>;
  riskLevel: number; // 1 = safe, 2 = moderate, 3 = high
  execute: (args: any, ctx: ToolContext) => Promise<any>;
}

export interface AgentExecutorResult {
  success: boolean;
  steps: AgentStep[];
  finalOutput: any;
  error?: string;
  tokensUsed: number;
  durationMs: number;
}

export interface AgentStep {
  step: number;
  thought?: string;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
  timestamp: Date;
}
