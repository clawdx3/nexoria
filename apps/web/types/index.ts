export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl?: string | null
  isActive: boolean
  createdAt: string
}

export interface AuthResponse {
  accessToken: string
  user: User
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface Workspace {
  id: string
  name: string
  description: string
  logoUrl?: string | null
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceMember {
  id: string
  userId: string
  email: string
  firstName: string
  lastName: string
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
  isActive: boolean
  joinedAt: string
}

export interface AddMemberPayload {
  email: string
  role: string
}

export interface Task {
  id: string
  workspaceId: string
  projectId?: string | null
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  assignedToId?: string | null
  dueDate?: string | null
  tags?: string[]
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Approval {
  id: string
  workspaceId: string
  type: ApprovalType
  status: ApprovalStatus
  title: string
  description?: string | null
  taskId?: string | null
  missionId?: string | null
  draftId?: string | null
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated'
export type ApprovalType = 'draft' | 'task' | 'autonomy_action' | 'spend'

export interface ApprovalDecision {
  id: string
  approvalId: string
  userId: string
  outcome: string
  reason?: string | null
  createdAt: string
}

export interface AgentProfile {
  id: string
  workspaceId: string
  name: string
  description: string
  modelProvider: string
  modelName: string
  modelConfig?: Record<string, any>
  enabledTools?: string[]
  role: string
  defaultAutonomyLevel: number
  isBuiltIn: boolean
  createdAt: string
  updatedAt: string
}

export interface MemoryEntry {
  id: string
  userId: string
  tier: string
  type: string
  content: string
  confidence: number
  positiveUses: number
  negativeUses: number
  createdAt: string
}

export interface Integration {
  id: string
  workspaceId: string
  type: string
  status: string
  config?: Record<string, any>
  createdAt: string
  updatedAt: string
}

export interface Playbook {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  steps?: PlaybookStep[]
  triggers?: Record<string, any>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface PlaybookStep {
  id: string
  agentProfileId?: string | null
  action: string
  params?: Record<string, any>
  order: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  agentProfileId?: string | null
  agentName?: string | null
  timestamp: string
}

export interface BusinessProfile {
  businessName: string
  toneOfVoice?: string
  brandRules?: string
  languages?: string[]
  openingHours?: string
  targetCustomers?: string
  doNotSayRules?: string
}

export interface CreateAgentPayload {
  name: string
  description?: string
  systemPrompt: string
  modelProvider: string
  modelName: string
  enabledTools?: string[]
  autonomyLevel?: number
}

export interface Toast {
  id: string
  title: string
  description?: string
  type: 'success' | 'error' | 'warning' | 'info'
}
