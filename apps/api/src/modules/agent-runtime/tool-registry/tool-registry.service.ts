import { Injectable, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AgentTool, ToolContext } from '../../../shared/interfaces/agent.interfaces';
import { z } from 'zod';
import { openWebpageTool, createOpenWebpageTool } from '../tools/open-webpage.tool';
import { TasksService } from '../../tasks/tasks.service';
import { BrowserService } from '../../browser/browser.service';
import { MemoryService } from '../../memory/memory.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { AskUserInterrupt } from '@nexoria/agent-core';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

@Injectable()
export class ToolRegistryService {
  private tools: Map<string, AgentTool> = new Map();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly browserService?: BrowserService,
  ) {
    this.registerBuiltIns();
  }

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  listForContext(ctx: ToolContext): AgentTool[] {
    const enabled = ctx.agentProfile.enabledTools;
    if (!enabled || !enabled.length) return Array.from(this.tools.values());
    const whitelist = new Set(enabled);
    return Array.from(this.tools.values()).filter((t) => whitelist.has(t.name));
  }

  private registerBuiltIns(): void {
    // ───── Tasks ─────
    this.register({
      name: 'create_task',
      description: 'Create an internal task in the workspace.',
      schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        const tasksService = this.moduleRef.get(TasksService, { strict: false });
        const task = await tasksService.create(ctx.workspaceId, {
          title: args.title,
          description: args.description,
          priority: args.priority ?? 'medium',
          metadata: {
            createdByTool: 'create_task',
            agentProfileId: ctx.agentProfile.id,
          },
        });
        return { success: true, task };
      },
    });

    this.register({
      name: 'list_tasks',
      description: 'List current workspace tasks.',
      schema: z.object({}),
      riskLevel: 1,
      execute: async (_args, ctx) => {
        const tasksService = this.moduleRef.get(TasksService, { strict: false });
        const tasks = await tasksService.findByWorkspace(ctx.workspaceId);
        return { success: true, tasks };
      },
    });

    this.register({
      name: 'update_task',
      description: 'Update a task status, priority, title, or description.',
      schema: z.object({
        taskId: z.string().describe('UUID of the task to update'),
        status: z.enum(['pending', 'in_progress', 'done', 'cancelled']).optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
      }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        const tasksService = this.moduleRef.get(TasksService, { strict: false });
        const patch: Record<string, any> = {};
        if (args.status) patch.status = args.status as TaskStatus;
        if (args.priority) patch.priority = args.priority as TaskPriority;
        if (args.title !== undefined) patch.title = args.title;
        if (args.description !== undefined) patch.description = args.description;
        const updated = await tasksService.update(args.taskId, ctx.workspaceId, patch);
        return { success: true, task: updated };
      },
    });

    // ───── Approvals ─────
    this.register({
      name: 'create_approval',
      description: 'Create an approval request for the user to review. Useful for decisions that need human confirmation before proceeding.',
      schema: z.object({
        title: z.string().describe('Short title of what needs approval'),
        description: z.string().describe('Detailed explanation of the decision or action'),
        type: z.enum(['general', 'task', 'social_post', 'budget', 'content']).optional(),
      }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        const approvalsService = this.moduleRef.get('ApprovalsService', { strict: false });
        if (!approvalsService) return { success: false, error: 'Approvals service not available' };
        const approval = await approvalsService.create(ctx.workspaceId, {
          title: args.title,
          description: args.description,
          type: args.type ?? 'general',
          metadata: { createdByTool: 'create_approval', agentProfileId: ctx.agentProfile.id },
        });
        return { success: true, approval };
      },
    });

    this.register({
      name: 'list_approvals',
      description: 'List pending or recent approvals in the workspace.',
      schema: z.object({
        status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        const approvalsService = this.moduleRef.get('ApprovalsService', { strict: false });
        if (!approvalsService) return { success: false, error: 'Approvals service not available' };
        const items = await approvalsService.findByWorkspace(ctx.workspaceId);
        const filtered = args.status ? items.filter((a: any) => a.status === args.status) : items;
        return { success: true, approvals: filtered };
      },
    });

    // ───── Social Post Drafts ─────
    this.register({
      name: 'create_social_post_draft',
      description: 'Create a social media post draft (Facebook, Instagram, LinkedIn, X). The user can review and approve it later.',
      schema: z.object({
        platform: z.enum(['facebook', 'instagram', 'linkedin', 'x', 'generic']).describe('Social platform'),
        title: z.string().describe('Internal title for the draft'),
        copy: z.string().describe('The actual post text'),
        topic: z.string().optional().describe('Campaign topic or subject'),
        mediaBrief: z.string().optional().describe('Suggested image/video direction'),
      }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        const draftsService = this.moduleRef.get('SocialPostDraftsService', { strict: false });
        if (!draftsService) return { success: false, error: 'Social post drafts service not available' };
        const draft = await draftsService.create(ctx.workspaceId, {
          platform: args.platform,
          title: args.title,
          copy: args.copy,
          topic: args.topic,
          mediaBrief: args.mediaBrief,
          createReviewTask: true,
          metadata: { createdByTool: 'create_social_post_draft', agentProfileId: ctx.agentProfile.id },
        });
        return { success: true, draft };
      },
    });

    this.register({
      name: 'list_social_post_drafts',
      description: 'List social media post drafts in the workspace.',
      schema: z.object({
        platform: z.enum(['facebook', 'instagram', 'linkedin', 'x', 'generic']).optional(),
        status: z.enum(['draft', 'review', 'approved', 'scheduled', 'published', 'rejected']).optional(),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        const draftsService = this.moduleRef.get('SocialPostDraftsService', { strict: false });
        if (!draftsService) return { success: false, error: 'Social post drafts service not available' };
        const drafts = await draftsService.findByWorkspace(ctx.workspaceId);
        const filtered = drafts.filter((d: any) => {
          if (args.platform && d.platform !== args.platform) return false;
          if (args.status && d.status !== args.status) return false;
          return true;
        });
        return { success: true, drafts: filtered };
      },
    });

    // ───── Memory ─────
    this.register({
      name: 'create_memory',
      description: 'Write a fact, preference, or insight to the agent\'s long-term memory. Use this when the user shares something important they want remembered across conversations.',
      schema: z.object({
        content: z.string().describe('The fact or insight to remember'),
        type: z.enum(['fact', 'preference', 'insight', 'rule', 'goal']).describe('Memory category'),
        tier: z.enum(['session', 'daily', 'long_term']).optional().describe('Storage tier (default: long_term)'),
        confidence: z.number().min(0).max(1).optional().describe('Confidence level 0-1 (default: 0.9)'),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        const memoryService = this.moduleRef.get(MemoryService, { strict: false });
        if (!memoryService) return { success: false, error: 'Memory service not available' };
        const entry = await memoryService.create(ctx.workspaceId, {
          content: args.content,
          type: args.type,
          tier: (args.tier ?? 'long_term') as any,
          confidence: args.confidence ?? 0.9,
          userId: ctx.triggeredByUserId,
          sessionId: ctx.sessionId,
          metadata: { createdByTool: 'create_memory', agentProfileId: ctx.agentProfile.id },
        });
        return { success: true, memory: entry };
      },
    });

    this.register({
      name: 'search_memory',
      description: 'Search the agent\'s memory for facts, preferences, or past insights. Use this before answering questions about the user or workspace history.',
      schema: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().optional().describe('Max results (default: 5)'),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        const memoryService = this.moduleRef.get(MemoryService, { strict: false });
        if (!memoryService) return { success: false, error: 'Memory service not available' };
        const results = await memoryService.searchByText(ctx.workspaceId, args.query, args.limit ?? 5);
        return { success: true, memories: results };
      },
    });

    // ───── Web ─────
    this.register({
      name: 'search_web',
      description: 'Search the web using DuckDuckGo. Returns titles, URLs, and snippets. No API key required.',
      schema: z.object({
        query: z.string().describe('Search query'),
        maxResults: z.number().optional().describe('Max results (default: 5, max: 10)'),
      }),
      riskLevel: 2,
      execute: async (args) => {
        const maxResults = Math.min(args.maxResults || 5, 10);
        try {
          const encoded = encodeURIComponent(args.query);
          const html = await (await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NexoriaBot/1.0)' },
            signal: AbortSignal.timeout(10000),
          })).text();

          const results: Array<{ title: string; url: string; snippet: string }> = [];
          const linkRe = /<a rel="nofollow" class="result__a" href="(https?:\/\/[^"]+)">(.*?)<\/a>/g;
          const snippetRe = /<a class="result__snippet">(.*?)<\/a>/g;

          let linkMatch;
          let snippetMatch;
          while ((linkMatch = linkRe.exec(html)) !== null && results.length < maxResults) {
            snippetMatch = snippetRe.exec(html);
            results.push({
              title: linkMatch[2].replace(/<[^>]+>/g, ''),
              url: linkMatch[1],
              snippet: (snippetMatch ? snippetMatch[1] : '').replace(/<[^>]+>/g, ''),
            });
          }

          if (results.length === 0) {
            return { success: false, error: 'No search results found' };
          }
          return { success: true, results };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      },
    });

    this.register({
      name: 'web_fetch',
      description: 'Fetch a URL and return the content. Useful for reading web pages, APIs, or documentation.',
      schema: z.object({
        url: z.string().url().describe('The URL to fetch'),
        format: z.enum(['text', 'json']).optional().describe('Response format (default: text)'),
        maxChars: z.number().optional().describe('Max characters to return (default: 10000)'),
      }),
      riskLevel: 2,
      execute: async (args) => {
        const maxChars = args.maxChars || 10000;
        try {
          const res = await fetch(args.url, {
            headers: { 'User-Agent': 'Nexoria-Agent/1.0' },
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };

          if (args.format === 'json') {
            const data = await res.json();
            return { success: true, data };
          }

          const text = await res.text();
          return { success: true, content: text.length > maxChars ? text.slice(0, maxChars) + `\n... [truncated, ${text.length} chars total]` : text, url: args.url };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      },
    });

    if (this.browserService) {
      this.register(createOpenWebpageTool(this.browserService));
    } else {
      this.register(openWebpageTool);
    }

    // -- My Tools --
    this.register({
      name: 'ask_user',
      description: 'Interrupts the agent loop with a question or approval request for the user. Creates an Approval row and throws AskUserInterrupt.',
      schema: z.object({
        question: z.string().describe('Question or decision title'),
        options: z.array(z.string()).optional().describe('Available options (e.g., "Approve", "Reject", "Modify")'),
      }),
      riskLevel: 1,
      exclusive: true,
      execute: async (args, ctx) => {
        const approvalsService = this.moduleRef.get('ApprovalsService', { strict: false });
        if (!approvalsService) throw new AskUserInterrupt('', 'Approvals service not available');
        const approval = await approvalsService.create(ctx.workspaceId, {
          title: args.question,
          description: 'Waiting for user response.',
          type: 'general',
          metadata: { createdByTool: 'ask_user', sessionId: ctx.sessionId, agentProfileId: ctx.agentProfile.id },
        });
        throw new AskUserInterrupt(approval.id, args.question);
      },
    });

    this.register({
      name: 'my_config',
      description: 'Read or update agent runtime config and scratchpad. Sensitive keys are blocked from writes.',
      schema: z.object({
        action: z.enum(['read', 'write']).describe('read or write'),
        key: z.string().describe('Config key (e.g., "modelName", "maxTokens", "systemPrompt")'),
        value: z.string().optional().describe('Value for writes'),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        const blocked = ['apiKey', 'api_key', 'jwtSecret', 'password', 'token', 'secret'];
        if (blocked.includes(args.key.toLowerCase())) return { success: false, error: 'Key is blocked for writes' };

        if (args.action === 'read') {
          const profile = ctx.agentProfile;
          const scratchpad = ctx.scratchpad ?? {};
          const keys = ['modelProvider', 'modelName', 'maxTokens', 'temperature', 'systemPrompt', 'enabledTools'];
          const display: Record<string, any> = {};
          for (const k of keys) display[k] = (profile as any)[k] ?? undefined;
          display.scratchpad = scratchpad;
          return { success: true, config: display };
        }

        if (args.action === 'write') {
          if (!ctx.scratchpad) (ctx as any).scratchpad = {};
          ctx.scratchpad![args.key] = args.value;
          return { success: true, key: args.key, value: args.value };
        }

        return { success: false, error: 'Unknown action' };
      },
    });

    this.register({
      name: 'nudge_memory',
      description: 'Intentionally persist important knowledge from this conversation to long-term memory. Use after completing significant tasks, learning something important about the user, or when the user explicitly asks to remember something.',
      schema: z.object({
        content: z.string().describe('The knowledge to persist (single sentence, third person)'),
        type: z.enum(['fact', 'preference', 'avoidance', 'pattern']).describe('Type of memory'),
        tier: z.enum(['daily', 'long_term']).optional().describe('Target tier (default: long_term)'),
        confidence: z.number().min(0.1).max(1.0).optional().describe('Confidence score (default: 0.95)'),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        const memoryService = this.moduleRef.get(MemoryService, { strict: false });
        const embeddingService = this.moduleRef.get(EmbeddingService, { strict: false });
        if (!memoryService) return { success: false, error: 'Memory service not available' };

        let embedding: number[] | null = null;
        if (embeddingService?.isReady()) {
          try { embedding = await embeddingService.embed(args.content); } catch { /* skip */ }
        }

        const entry = await memoryService.create(ctx.workspaceId, {
          userId: ctx.triggeredByUserId,
          tier: args.tier ?? 'long_term',
          type: args.type,
          content: args.content,
          confidence: args.confidence ?? 0.95,
          metadata: {
            source: 'nudge_memory',
            agentProfileId: ctx.agentProfile.id,
            sessionId: ctx.sessionId,
          },
        });

        return { success: true, memoryId: entry.id, tier: args.tier ?? 'long_term', content: args.content };
      },
    });
  }
}
