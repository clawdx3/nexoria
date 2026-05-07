import { Injectable } from '@nestjs/common';
import { AgentTool, ToolContext } from '../../../shared/interfaces/agent.interfaces';
import { z } from 'zod';
import { openWebpageTool } from '../tools/open-webpage.tool';

@Injectable()
export class ToolRegistryService {
  private tools: Map<string, AgentTool> = new Map();

  constructor() {
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
    this.register({
      name: 'delegate_task',
      description: 'Create an internal task in the workspace.',
      schema: z.object({ title: z.string(), description: z.string().optional(), priority: z.enum(['low', 'medium', 'high', 'urgent']).optional() }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        // Tool implementations are injected with their respective services in practice.
        // Here we return a structured result for the executor.
        return { success: true, task: { title: args.title, description: args.description, priority: args.priority ?? 'medium', workspaceId: ctx.workspaceId } };
      },
    });

    this.register({
      name: 'search_products',
      description: 'Search products in connected integrations.',
      schema: z.object({ query: z.string(), limit: z.number().optional() }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        return { success: true, query: args.query, limit: args.limit ?? 10, workspaceId: ctx.workspaceId };
      },
    });

    this.register({
      name: 'create_fb_draft',
      description: 'Create a Facebook post draft.',
      schema: z.object({ text: z.string(), imageUrl: z.string().optional(), scheduledAt: z.string().optional() }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        return { success: true, platform: 'facebook', draft: args, workspaceId: ctx.workspaceId };
      },
    });

    this.register({
      name: 'create_ig_draft',
      description: 'Create an Instagram post draft.',
      schema: z.object({ caption: z.string(), imageUrl: z.string().optional(), hashtags: z.array(z.string()).optional(), scheduledAt: z.string().optional() }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        return { success: true, platform: 'instagram', draft: args, workspaceId: ctx.workspaceId };
      },
    });

    this.register({
      name: 'generate_image',
      description: 'Generate an image via AI image model.',
      schema: z.object({ prompt: z.string(), size: z.enum(['256x256', '512x512', '1024x1024']).optional() }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        return { success: true, prompt: args.prompt, size: args.size ?? '1024x1024', workspaceId: ctx.workspaceId };
      },
    });

    this.register({
      name: 'draft_email_reply',
      description: 'Draft a professional email reply.',
      schema: z.object({ originalBody: z.string(), tone: z.enum(['formal', 'friendly', 'apologetic']).optional(), keyPoints: z.array(z.string()).optional() }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        return { success: true, draft: { originalBody: args.originalBody, tone: args.tone ?? 'friendly' }, workspaceId: ctx.workspaceId };
      },
    });

    this.register({
      name: 'create_internal_task',
      description: 'Create an internal task with optional assignee.',
      schema: z.object({ title: z.string(), description: z.string().optional(), assigneeId: z.string().optional(), dueDate: z.string().optional() }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        return { success: true, task: { ...args, workspaceId: ctx.workspaceId } };
      },
    });

    this.register(openWebpageTool);
  }
}
