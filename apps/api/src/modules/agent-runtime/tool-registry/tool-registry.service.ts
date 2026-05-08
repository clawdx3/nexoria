import { Injectable, Optional } from '@nestjs/common'
import { AgentTool, ToolContext } from '../../../shared/interfaces/agent.interfaces'
import { z } from 'zod'
import { openWebpageTool, createOpenWebpageTool } from '../tools/open-webpage.tool'
import { TasksService } from '../../tasks/tasks.service'
import { BrowserService } from '../../browser/browser.service'

@Injectable()
export class ToolRegistryService {
  private tools: Map<string, AgentTool> = new Map()

  constructor(
    private readonly tasksService: TasksService,
    @Optional() private readonly browserService?: BrowserService,
  ) {
    this.registerBuiltIns()
  }

  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name)
  }

  listForContext(ctx: ToolContext): AgentTool[] {
    const enabled = ctx.agentProfile.enabledTools
    if (!enabled || !enabled.length) return Array.from(this.tools.values())
    const whitelist = new Set(enabled)
    return Array.from(this.tools.values()).filter((t) => whitelist.has(t.name))
  }

  private registerBuiltIns(): void {
    this.register({
      name: 'delegate_task',
      description: 'Create an internal task in the workspace.',
      schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        const task = await this.tasksService.create(ctx.workspaceId, {
          title: args.title,
          description: args.description,
          priority: args.priority ?? 'medium',
          metadata: {
            createdByTool: 'delegate_task',
            agentProfileId: ctx.agentProfile.id,
          },
        })
        return { success: true, task }
      },
    })

    this.register({
      name: 'list_tasks',
      description: 'List current workspace tasks.',
      schema: z.object({}),
      riskLevel: 1,
      execute: async (_args, ctx) => {
        const tasks = await this.tasksService.findByWorkspace(ctx.workspaceId)
        return { success: true, tasks }
      },
    })

    this.register({
      name: 'create_internal_task',
      description: 'Create an internal task with optional assignee.',
      schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        assigneeId: z.string().optional(),
        dueDate: z.string().optional(),
      }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        const task = await this.tasksService.create(ctx.workspaceId, {
          title: args.title,
          description: args.description,
          assignedToId: args.assigneeId,
          dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
          metadata: {
            createdByTool: 'create_internal_task',
            agentProfileId: ctx.agentProfile.id,
          },
        })
        return { success: true, task }
      },
    })

    this.register({
      name: 'create_task',
      description: 'Create a workspace task. Alias for create_internal_task.',
      schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        dueDate: z.string().optional(),
      }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        const task = await this.tasksService.create(ctx.workspaceId, {
          title: args.title,
          description: args.description,
          priority: args.priority ?? 'medium',
          dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
          metadata: {
            createdByTool: 'create_task',
            agentProfileId: ctx.agentProfile.id,
          },
        })
        return { success: true, task }
      },
    })

    // If a BrowserService is injected via DI, register the Camofox version
    // of open_webpage that uses the anti-detection browser instead of raw Playwright.
    // Injecting BrowserService into ToolRegistryService cleanly removes the need for
    // dynamic ModuleRef.get() hacks in the tool itself.
    if (this.browserService) {
      this.register(createOpenWebpageTool(this.browserService))
    } else {
      this.register(openWebpageTool)
    }
  }
}
