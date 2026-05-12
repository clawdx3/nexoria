import { z } from 'zod';

export type ToolTier = 'lite' | 'pro' | 'both';
export type ToolRiskLevel = 1 | 2 | 3;

export interface ToolManifestEntry {
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  tier: ToolTier;
  requiresSandbox: boolean;
  schema: z.ZodTypeAny;
}

/**
 * Canonical tool catalog for Nexoria.
 *
 * Usage:
 * - SaaS `ToolRegistryService` registers all entries with `tier !== 'pro'`
 * - Pro Agent registers all entries with `tier !== 'lite'`
 * - `AgentProfile.enabledTools` is validated against these names
 */
export const TOOL_MANIFEST: ToolManifestEntry[] = [
  // ───── Tasks ───── (both tiers)
  {
    name: 'create_task',
    description: 'Create a tracked task in the workspace with title, description, and optional priority.',
    riskLevel: 2,
    tier: 'both',
    requiresSandbox: false,
    schema: z.object({
      title: z.string().describe('Task title'),
      description: z.string().optional().describe('Task details'),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    }),
  },
  {
    name: 'list_tasks',
    description: 'List workspace tasks with optional status filter.',
    riskLevel: 1,
    tier: 'both',
    requiresSandbox: false,
    schema: z.object({
      status: z.enum(['pending', 'in_progress', 'done', 'cancelled']).optional().describe('Filter by status'),
    }),
  },
  {
    name: 'update_task',
    description: 'Update a task status, priority, title, or description.',
    riskLevel: 2,
    tier: 'both',
    requiresSandbox: false,
    schema: z.object({
      taskId: z.string().describe('UUID of the task to update'),
      status: z.enum(['pending', 'in_progress', 'done', 'cancelled']).optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
    }),
  },

  // ───── Approvals ───── (both tiers)
  {
    name: 'create_approval',
    description: 'Create an approval request for the user to review. Useful for decisions that need human confirmation.',
    riskLevel: 2,
    tier: 'both',
    requiresSandbox: false,
    schema: z.object({
      title: z.string().describe('Short title of what needs approval'),
      description: z.string().describe('Detailed explanation'),
      type: z.enum(['general', 'task', 'social_post', 'budget', 'content']).optional(),
    }),
  },
  {
    name: 'list_approvals',
    description: 'List pending or recent approvals in the workspace.',
    riskLevel: 1,
    tier: 'both',
    requiresSandbox: false,
    schema: z.object({
      status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
    }),
  },

  // ───── Social Post Drafts ───── (lite / both)
  {
    name: 'create_social_post_draft',
    description: 'Create a social media post draft for review.',
    riskLevel: 2,
    tier: 'both',
    requiresSandbox: false,
    schema: z.object({
      platform: z.enum(['facebook', 'instagram', 'linkedin', 'x', 'generic']).describe('Social platform'),
      title: z.string().describe('Internal title'),
      copy: z.string().describe('Post text'),
      topic: z.string().optional(),
      mediaBrief: z.string().optional(),
    }),
  },
  {
    name: 'list_social_post_drafts',
    description: 'List social media post drafts in the workspace.',
    riskLevel: 1,
    tier: 'both',
    requiresSandbox: false,
    schema: z.object({
      platform: z.enum(['facebook', 'instagram', 'linkedin', 'x', 'generic']).optional(),
      status: z.enum(['draft', 'review', 'approved', 'scheduled', 'published', 'rejected']).optional(),
    }),
  },

  // ───── Memory ───── (both tiers)
  {
    name: 'create_memory',
    description: 'Write a fact, preference, or insight to long-term memory.',
    riskLevel: 1,
    tier: 'both',
    requiresSandbox: false,
    schema: z.object({
      content: z.string().describe('The fact or insight'),
      type: z.enum(['fact', 'preference', 'insight', 'rule', 'goal']).describe('Memory category'),
      tier: z.enum(['session', 'daily', 'long_term']).optional(),
      confidence: z.number().min(0).max(1).optional(),
    }),
  },
  {
    name: 'search_memory',
    description: 'Search memory for facts, preferences, or past insights.',
    riskLevel: 1,
    tier: 'both',
    requiresSandbox: false,
    schema: z.object({
      query: z.string().describe('Search query'),
      limit: z.number().optional().describe('Max results (default: 5)'),
    }),
  },
  {
    name: 'nudge_memory',
    description: 'Intentionally persist important knowledge to long-term memory with high confidence.',
    riskLevel: 1,
    tier: 'both',
    requiresSandbox: false,
    schema: z.object({
      content: z.string().describe('Knowledge to persist'),
      type: z.enum(['fact', 'preference', 'avoidance', 'pattern']).describe('Type of memory'),
      tier: z.enum(['daily', 'long_term']).optional(),
      confidence: z.number().min(0.1).max(1.0).optional(),
    }),
  },

  // ───── Web ───── (both tiers)
  {
    name: 'search_web',
    description: 'Search the web using DuckDuckGo. Returns titles, URLs, and snippets.',
    riskLevel: 2,
    tier: 'both',
    requiresSandbox: false,
    schema: z.object({
      query: z.string().describe('Search query'),
      maxResults: z.number().optional().describe('Max results (default: 5, max: 10)'),
    }),
  },
  {
    name: 'web_fetch',
    description: 'Fetch a URL and return the content.',
    riskLevel: 2,
    tier: 'both',
    requiresSandbox: false,
    schema: z.object({
      url: z.string().url().describe('The URL to fetch'),
      format: z.enum(['text', 'json']).optional(),
      maxChars: z.number().optional(),
    }),
  },

  // ───── Browser ───── (lite only)
  {
    name: 'open_webpage',
    description: 'Open a webpage and return the rendered text content.',
    riskLevel: 2,
    tier: 'lite',
    requiresSandbox: true,
    schema: z.object({
      url: z.string().url().describe('URL to open'),
    }),
  },

  // ───── Pro-only (sandboxed / high risk) ─────
  {
    name: 'terminal',
    description: 'Execute a shell command. Returns stdout/stderr. Timeout: 30s.',
    riskLevel: 3,
    tier: 'pro',
    requiresSandbox: true,
    schema: z.object({
      command: z.string().describe('The shell command to execute'),
      cwd: z.string().optional().describe('Working directory relative to workspace'),
      timeout: z.number().optional().describe('Timeout in ms (max 60000)'),
    }),
  },
  {
    name: 'fs',
    description: 'Read, write, list, or delete workspace files.',
    riskLevel: 3,
    tier: 'pro',
    requiresSandbox: true,
    schema: z.object({
      action: z.enum(['read', 'write', 'list', 'delete', 'mkdir']),
      path: z.string().describe('File or directory path relative to workspace'),
      content: z.string().optional(),
      recursive: z.boolean().optional(),
    }),
  },
  {
    name: 'execute_code',
    description: 'Execute Python or Node.js code in a sandboxed environment.',
    riskLevel: 3,
    tier: 'pro',
    requiresSandbox: true,
    schema: z.object({
      language: z.enum(['python', 'javascript', 'bash']),
      code: z.string().describe('The code to execute'),
      timeout: z.number().optional(),
    }),
  },
  {
    name: 'generate_image',
    description: 'Generate an image using AI (DALL-E) and save it to the workspace.',
    riskLevel: 2,
    tier: 'pro',
    requiresSandbox: false,
    schema: z.object({
      prompt: z.string().describe('Detailed image description'),
      filename: z.string().describe('Output filename'),
      size: z.enum(['1024x1024', '1792x1024', '1024x1792']).optional(),
      quality: z.enum(['standard', 'hd']).optional(),
    }),
  },
  {
    name: 'create_chart',
    description: 'Create a chart from data using matplotlib and save it to the workspace.',
    riskLevel: 2,
    tier: 'pro',
    requiresSandbox: true,
    schema: z.object({
      data: z.array(z.record(z.any())),
      chartType: z.enum(['bar', 'line', 'pie', 'scatter', 'hist']),
      xKey: z.string(),
      yKey: z.string(),
      title: z.string().optional(),
      filename: z.string(),
      width: z.number().optional(),
      height: z.number().optional(),
    }),
  },
  {
    name: 'convert_document',
    description: 'Convert between document formats using pandoc.',
    riskLevel: 2,
    tier: 'pro',
    requiresSandbox: false,
    schema: z.object({
      inputPath: z.string().describe('Input file path relative to workspace'),
      outputPath: z.string().describe('Output file path relative to workspace'),
      fromFormat: z.string().optional(),
      toFormat: z.string().optional(),
      extraArgs: z.string().optional(),
    }),
  },
  {
    name: 'analyze_document',
    description: 'Extract text content from PDF, DOCX, or other documents.',
    riskLevel: 2,
    tier: 'pro',
    requiresSandbox: false,
    schema: z.object({
      path: z.string().describe('Document path relative to workspace'),
      maxChars: z.number().optional().describe('Max characters to return (default: 20000)'),
    }),
  },
  {
    name: 'send_email',
    description: 'Send an email via SMTP using the configured mail server.',
    riskLevel: 2,
    tier: 'pro',
    requiresSandbox: false,
    schema: z.object({
      to: z.string().email().describe('Recipient email address'),
      subject: z.string().describe('Email subject'),
      body: z.string().describe('Plain text body'),
      from: z.string().optional().describe('Sender address'),
    }),
  },
  {
    name: 'process_list',
    description: 'List running processes for debugging and monitoring.',
    riskLevel: 2,
    tier: 'pro',
    requiresSandbox: false,
    schema: z.object({
      filter: z.string().optional().describe('Filter by process name'),
    }),
  },
  {
    name: 'delegate_to_specialist',
    description: 'Delegate a task to a specialist agent that runs locally. Available specialists: social_media, email_outreach, researcher, content_creator, code_reviewer.',
    riskLevel: 1,
    tier: 'pro',
    requiresSandbox: false,
    schema: z.object({
      specialistId: z.string().describe('Specialist ID'),
      prompt: z.string().describe('Detailed prompt for the specialist'),
    }),
  },

  // ───── Meta ─────
  {
    name: 'ask_user',
    description: 'Interrupt the agent loop with a question or approval request for the user.',
    riskLevel: 1,
    tier: 'both',
    requiresSandbox: false,
    schema: z.object({
      question: z.string().describe('Question or decision title'),
      options: z.array(z.string()).optional().describe('Available options'),
    }),
  },
  {
    name: 'my_config',
    description: 'Read or update agent runtime config and scratchpad.',
    riskLevel: 1,
    tier: 'both',
    requiresSandbox: false,
    schema: z.object({
      action: z.enum(['read', 'write']).describe('read or write'),
      key: z.string().describe('Config key'),
      value: z.string().optional().describe('Value for writes'),
    }),
  },
];

export const TOOL_NAMES = TOOL_MANIFEST.map((t) => t.name);

export function getToolsForTier(tier: ToolTier | 'lite' | 'pro'): ToolManifestEntry[] {
  if (tier === 'both') return TOOL_MANIFEST;
  return TOOL_MANIFEST.filter((t) => t.tier === tier || t.tier === 'both');
}

export function getProOnlyTools(): ToolManifestEntry[] {
  return TOOL_MANIFEST.filter((t) => t.tier === 'pro');
}

export function getLiteTools(): ToolManifestEntry[] {
  return TOOL_MANIFEST.filter((t) => t.tier === 'lite' || t.tier === 'both');
}
