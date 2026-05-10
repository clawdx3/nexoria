// Power Agent Runtime Configuration
// All config comes from Nexoria API at boot, then synced over WebSocket

export interface AgentConfig {
  version: string;
  userId: string;
  workspaceId: string;
  agentId: string;
  
  // Personality / Soul
  personality: {
    name: string;
    systemPrompt: string;
    tone: string;
    autonomyLevel: number; // 1-5
  };
  
  // Roles / Subagents
  roles: Record<string, RoleConfig>;
  
  // Model routing
  models: {
    default: string;
    fast: string;
    providers: ProviderConfig[];
  };
  
  // Memory
  memory: {
    compactionThreshold: number;
    maxContextTokens: number;
    localStorePath: string;
  };
  
  // Tools
  tools: {
    enabled: string[];
    custom: CustomToolConfig[];
  };
  
  // Skills
  skills: {
    enabled: string[];
    registry: string; // URL to skill registry
  };
  
  // Runtime limits
  limits: {
    maxSubagents: number;
    timeoutSeconds: number;
    maxOutputFiles: number;
  };
}

export interface RoleConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  enabledTools: string[];
  model: string;
  maxConcurrency: number;
}

export interface ProviderConfig {
  id: string;
  type: 'openai' | 'openrouter' | 'ollama' | 'anthropic';
  baseUrl?: string;
  apiKey?: string; // Can be provided by user or from Nexoria vault
  models: string[];
}

export interface CustomToolConfig {
  id: string;
  name: string;
  scriptPath: string; // Path to tool implementation
  schema: Record<string, any>; // JSON schema for parameters
}

export interface HubConnectionConfig {
  hubUrl: string;
  token: string;
  instanceKey: string;
  reconnectMs: number;
  maxReconnectMs: number;
  heartbeatMs: number;
}
