export interface MemoryContextRequest {
  workspaceId: string;
  userId: string;
  sessionId?: string;
  agentProfileId: string;
  query?: string;
}

export interface MemoryContextResult {
  text?: string;
  entries?: Array<{
    id?: string;
    content: string;
    tier?: string;
    confidence?: number;
  }>;
}

export interface MemoryStoreRequest {
  workspaceId: string;
  userId: string;
  content: string;
  tier?: string;
  type?: string;
  confidence?: number;
  sessionId?: string;
  metadata?: Record<string, any>;
  agentProfileId?: string;
}

export interface MemorySearchRequest {
  workspaceId: string;
  query: string;
  userId?: string;
  tier?: string;
  limit?: number;
  agentProfileId?: string;
}

export interface MemorySearchResult {
  id?: string;
  content: string;
  tier?: string;
  confidence?: number;
}

export interface MemoryManageParams {
  section?: 'memory' | 'user';
  content?: string;
  search?: string;
  replacement?: string;
}

export interface MemoryAdapter {
  loadContext(ctx: MemoryContextRequest): Promise<MemoryContextResult>;
  store(entry: MemoryStoreRequest): Promise<void>;
  search(query: MemorySearchRequest): Promise<MemorySearchResult[]>;
  manage?(action: 'add' | 'replace' | 'remove', params: MemoryManageParams): Promise<void>;
  initialize?(workspaceId: string, agentProfileId: string): Promise<void>;
}
