import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TasksService } from '../tasks/tasks.service';
import { SocialPostDraftsService } from '../social-post-drafts/social-post-drafts.service';
import { ManagedRuntimeService } from '../managed-runtime/managed-runtime.service';
import { AgentProfilesService } from '../agent-profiles/agent-profiles.service';
import { TaskPriority, TaskStatus } from '../../database/entities/task.entity';
import { SocialPostDraftStatus, SocialPostPlatform } from '../../database/entities/social-post-draft.entity';

const SERVER_INFO = { name: 'nexoria-mcp', version: '0.1.0' };
const MESSAGES_ENDPOINT = '/api/v1/mcp/messages';

type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  execute: (args: any) => Promise<any>;
};

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);
  private readonly tools = new Map<string, ToolDef>();
  private readonly transports = new Map<string, SSEServerTransport>();

  constructor(
    private readonly tasks: TasksService,
    private readonly socialPostDrafts: SocialPostDraftsService,
    private readonly managedRuntime: ManagedRuntimeService,
    private readonly agentProfiles: AgentProfilesService,
    private readonly config: ConfigService,
  ) {
    this.registerTaskTools();
    this.registerSocialPostDraftTools();
    this.registerRuntimeDelegationTools();
  }

  authenticate(authHeader: string | undefined): void {
    const expected = this.config.get<string>('NEXORIA_MCP_TOKEN') ?? process.env.NEXORIA_MCP_TOKEN;
    if (!expected) throw new UnauthorizedException('MCP token not configured on server');
    // OpenClaw bundle-mcp client appends headers, so the upstream may receive
    // a comma-joined value like "Bearer X, Bearer X". Accept the match if any
    // of the comma-separated parts matches the expected bearer token.
    const target = `Bearer ${expected}`;
    const parts = (authHeader ?? '').split(',').map((s) => s.trim());
    if (!parts.some((p) => p === target)) {
      throw new UnauthorizedException('Invalid MCP token');
    }
  }

  async openSseTransport(res: Response): Promise<void> {
    const transport = new SSEServerTransport(MESSAGES_ENDPOINT, res);
    this.transports.set(transport.sessionId, transport);
    res.on('close', () => {
      this.transports.delete(transport.sessionId);
      this.logger.debug(`mcp session closed: ${transport.sessionId}`);
    });
    const server = this.buildServerInstance();
    await server.connect(transport);
    this.logger.debug(`mcp session opened: ${transport.sessionId}`);
  }

  async handlePostedMessage(sessionId: string, req: Request, res: Response): Promise<void> {
    const transport = this.transports.get(sessionId);
    if (!transport) {
      res.status(400).json({ error: `No active MCP session for sessionId=${sessionId}` });
      return;
    }
    await transport.handlePostMessage(req, res, req.body);
  }

  private buildServerInstance(): Server {
    const server = new Server(SERVER_INFO, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Array.from(this.tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
      const tool = this.tools.get(req.params.name);
      if (!tool) {
        return { content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }], isError: true };
      }
      try {
        const result = await tool.execute(req.params.arguments ?? {});
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        this.logger.warn(`tool ${req.params.name} failed: ${err.message}`);
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
      }
    });
    return server;
  }

  private registerTaskTools(): void {
    this.tools.set('create_task', {
      name: 'create_task',
      description: [
        'Canonical Nexoria task creation tool. Use this whenever the user asks to create, add, track, plan, schedule, remember, assign, or capture work as a task.',
        'Do not claim a task was created unless this tool returns successfully.',
        'After success, mention the returned task id, title, status, and priority in the assistant response.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string', description: 'UUID of the active Nexoria workspace. Use the exact workspaceId supplied in the session context.' },
          title: { type: 'string', description: 'Short, action-oriented task title.' },
          description: { type: 'string', description: 'Optional longer task description with useful context from the user request.' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'Task priority. Use medium unless the user states urgency or impact.' },
          dueDate: { type: 'string', description: 'Optional ISO-8601 due date. Only set it when the user gives an explicit date or deadline.' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Optional concise labels derived from the user request.' },
        },
        required: ['workspaceId', 'title'],
      },
      execute: async (args) => {
        const dueDate = args.dueDate ? new Date(args.dueDate) : undefined;
        return this.tasks.create(args.workspaceId, {
          title: args.title,
          description: args.description,
          priority: args.priority as TaskPriority | undefined,
          dueDate,
          tags: args.tags,
          metadata: { createdByTool: 'mcp:create_task' },
        });
      },
    });

    this.tools.set('list_tasks', {
      name: 'list_tasks',
      description: [
        'Canonical Nexoria task lookup tool. Use this before updating a task when the user refers to it by title, partial title, description, or vague wording.',
        'Also use it when the user asks what tasks exist, what is pending, what is in progress, or what is done.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string', description: 'UUID of the active Nexoria workspace. Use the exact workspaceId supplied in the session context.' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'done', 'cancelled'], description: 'Optional status filter. Omit it when matching by title or searching broadly.' },
        },
        required: ['workspaceId'],
      },
      execute: async (args) => {
        const tasks = await this.tasks.findByWorkspace(args.workspaceId);
        const filtered = args.status ? tasks.filter((t) => t.status === args.status) : tasks;
        return { count: filtered.length, tasks: filtered };
      },
    });

    this.tools.set('update_task_status', {
      name: 'update_task_status',
      description: [
        'Canonical Nexoria task update tool. Use this whenever the user asks to mark a task done, start it, reopen it, cancel it, rename it, reprioritize it, or change its description.',
        'If the user does not provide an exact task id, first call list_tasks for the active workspace, choose the best matching task, then call this tool.',
        'Do not claim a task was updated unless this tool returns successfully.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'UUID of the task to update.' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'done', 'cancelled'], description: 'New task status when the user requests a status change.' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], description: 'New priority when the user requests priority or urgency changes.' },
          title: { type: 'string', description: 'New title when the user asks to rename or clarify the task.' },
          description: { type: 'string', description: 'New description when the user asks to add or change details.' },
        },
        required: ['taskId'],
      },
      execute: async (args) => {
        const patch: Record<string, any> = {};
        if (args.status) patch.status = args.status as TaskStatus;
        if (args.priority) patch.priority = args.priority as TaskPriority;
        if (args.title !== undefined) patch.title = args.title;
        if (args.description !== undefined) patch.description = args.description;
        return this.tasks.update(args.taskId, patch);
      },
    });
  }

  private registerSocialPostDraftTools(): void {
    this.tools.set('create_social_post_draft', {
      name: 'create_social_post_draft',
      description: [
        'Canonical Nexoria tool for creating social media post drafts, especially Facebook post drafts.',
        'Use this from delegated content/specialist execution whenever the assigned work is to create, draft, prepare, write, schedule, or publish a Facebook/social post.',
        'The main orchestrator should delegate new social/content creation to agentName "Content Creator" with delegate_runtime_job instead of writing final copy or calling this tool directly.',
        'This creates a durable draft record in Nexoria. Do not claim a social post draft was created unless this tool returns successfully.',
        'Default to createReviewTask=true for agent-created social drafts so the user can approve them in Nexoria.',
        'For delegated Content Creator work, include metadata.source="content_creator_runtime" and metadata.createdByAgentRole="content_creator".',
        'Only set createReviewTask=false when the user explicitly asks to save a private draft without review.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string', description: 'UUID of the active Nexoria workspace. Use the exact workspaceId supplied in the session context.' },
          platform: { type: 'string', enum: ['facebook', 'instagram', 'linkedin', 'x', 'generic'], description: 'Social platform. Use facebook for Facebook posts.' },
          title: { type: 'string', description: 'Short internal title for the draft, e.g. "Facebook post: spring sale".' },
          topic: { type: 'string', description: 'The campaign topic, user request, or subject the post is about.' },
          copy: { type: 'string', description: 'The actual post copy to save as the draft.' },
          mediaBrief: { type: 'string', description: 'Optional suggested image/video direction or creative brief.' },
          status: { type: 'string', enum: ['draft', 'review', 'approved', 'scheduled', 'published', 'rejected'], description: 'Use draft unless the user requests review, scheduling, or publishing.' },
          scheduledFor: { type: 'string', description: 'Optional ISO-8601 schedule time. Only set it when the user gives a date/time.' },
          createReviewTask: { type: 'boolean', description: 'Defaults to true. Set false only when the user explicitly asks to save a private draft without review.' },
          metadata: { type: 'object', description: 'Optional extra structured campaign details.' },
        },
        required: ['workspaceId', 'title', 'copy'],
      },
      execute: async (args) => this.socialPostDrafts.create(args.workspaceId, {
        platform: args.platform as SocialPostPlatform | undefined,
        title: args.title,
        topic: args.topic,
        copy: args.copy,
        mediaBrief: args.mediaBrief,
        status: args.status as SocialPostDraftStatus | undefined,
        scheduledFor: args.scheduledFor ? new Date(args.scheduledFor) : undefined,
        createReviewTask: args.createReviewTask ?? true,
        metadata: { ...(args.metadata ?? {}), createdByTool: 'mcp:create_social_post_draft' },
      }),
    });

    this.tools.set('list_social_post_drafts', {
      name: 'list_social_post_drafts',
      description: 'Canonical Nexoria tool for listing durable social post drafts in a workspace. Use it when the user asks to see, find, revise, approve, schedule, or publish an existing social/Facebook draft.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string', description: 'UUID of the active Nexoria workspace. Use the exact workspaceId supplied in the session context.' },
          platform: { type: 'string', enum: ['facebook', 'instagram', 'linkedin', 'x', 'generic'], description: 'Optional platform filter.' },
          status: { type: 'string', enum: ['draft', 'review', 'approved', 'scheduled', 'published', 'rejected'], description: 'Optional status filter.' },
        },
        required: ['workspaceId'],
      },
      execute: async (args) => {
        const drafts = await this.socialPostDrafts.findByWorkspace(args.workspaceId);
        const filtered = drafts.filter((draft) => {
          if (args.platform && draft.platform !== args.platform) return false;
          if (args.status && draft.status !== args.status) return false;
          return true;
        });
        return { count: filtered.length, drafts: filtered };
      },
    });

    this.tools.set('update_social_post_draft', {
      name: 'update_social_post_draft',
      description: [
        'Canonical Nexoria tool for updating a durable social post draft.',
        'Use this when the user asks to revise copy, change status, approve, schedule, reject, or attach task information to an existing Facebook/social draft.',
        'If the user does not provide the draft id, first call list_social_post_drafts and choose the best matching draft.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          draftId: { type: 'string', description: 'UUID of the social post draft to update.' },
          title: { type: 'string', description: 'Optional new internal title.' },
          topic: { type: 'string', description: 'Optional updated topic.' },
          copy: { type: 'string', description: 'Optional updated post copy.' },
          mediaBrief: { type: 'string', description: 'Optional updated media or creative brief.' },
          status: { type: 'string', enum: ['draft', 'review', 'approved', 'scheduled', 'published', 'rejected'], description: 'Optional updated status.' },
          scheduledFor: { type: 'string', description: 'Optional ISO-8601 schedule time.' },
          taskId: { type: 'string', description: 'Optional linked Nexoria task id.' },
          metadata: { type: 'object', description: 'Optional replacement metadata.' },
        },
        required: ['draftId'],
      },
      execute: async (args) => this.socialPostDrafts.update(args.draftId, {
        title: args.title,
        topic: args.topic,
        copy: args.copy,
        mediaBrief: args.mediaBrief,
        status: args.status as SocialPostDraftStatus | undefined,
        scheduledFor: args.scheduledFor ? new Date(args.scheduledFor) : undefined,
        taskId: args.taskId,
        metadata: args.metadata,
      }),
    });
  }

  private registerRuntimeDelegationTools(): void {
    this.tools.set('delegate_runtime_job', {
      name: 'delegate_runtime_job',
      description: [
        'Canonical Nexoria tool for offloading background agent work to OpenClaw runtime jobs.',
        'Use this when the orchestrator decides a specialist agent should work, or when the orchestrator would otherwise do non-trivial work itself.',
        'For social/content work, create a tracking task first, then call this with agentName "Content Creator" and the created taskId.',
        'If the orchestrator itself must do the work, set agentProfileId to "orchestrator" so the main chat stays free.',
        'Do not use this for normal conversation or quick answers.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string', description: 'UUID of the active Nexoria workspace. Use the exact workspaceId supplied in the session context.' },
          agentProfileId: { type: 'string', description: 'Target agent profile id. Use "orchestrator" to spawn a background main-agent run.' },
          agentName: { type: 'string', description: 'Optional target built-in or workspace agent name, e.g. "Content Creator". Used when agentProfileId is not known.' },
          taskId: { type: 'string', description: 'Optional Nexoria task id linked to this runtime job.' },
          prompt: { type: 'string', description: 'Clear work instructions for the delegated background agent.' },
          type: { type: 'string', enum: ['openclaw_task', 'create_file', 'research', 'browser_task'], description: 'Runtime job type. Use openclaw_task unless another type is clearly required.' },
          metadata: { type: 'object', description: 'Optional structured handoff metadata.' },
        },
        required: ['workspaceId', 'prompt'],
      },
      execute: async (args) => {
        const agentProfileId = await this.resolveDelegatedAgentId(args.workspaceId, args.agentProfileId, args.agentName);
        const agentName = typeof args.agentName === 'string' ? args.agentName : undefined;
        const isContentCreator = agentName?.trim().toLowerCase() === 'content creator';
        const delegatedPrompt = isContentCreator
          ? [
              'You are Nexoria Content Creator working on a delegated background job.',
              `Active Nexoria workspaceId: ${args.workspaceId}`,
              'Write the requested social/content draft yourself, then persist it with the Nexoria MCP create_social_post_draft tool.',
              'For Facebook posts, use platform "facebook". Set createReviewTask=true unless the user explicitly asked for a private draft.',
              'Set metadata.source="content_creator_runtime" and metadata.createdByAgentRole="content_creator" when creating the draft.',
              'Do not only return the copy in chat; the durable draft and approval are the source of truth.',
              '',
              args.prompt,
            ].join('\n')
          : args.prompt;
        const job = await this.managedRuntime.createJob(args.workspaceId, null, {
          agentProfileId,
          type: args.type ?? 'openclaw_task',
          input: {
            source: 'mcp:delegate_runtime_job',
            taskId: args.taskId,
            workspaceId: args.workspaceId,
            delegatedAgentName: agentName,
            prompt: delegatedPrompt,
            metadata: {
              ...(args.metadata ?? {}),
              delegatedAgentName: agentName,
              delegatedByTool: 'mcp:delegate_runtime_job',
            },
          },
        });
        if (args.taskId) {
          const task = await this.tasks.findOne(args.taskId);
          await this.tasks.update(args.taskId, {
            status: task.status === 'pending' ? 'in_progress' : task.status as TaskStatus,
            metadata: {
              ...(task.metadata ?? {}),
              handoffQueued: true,
              handoffStatus: 'runtime_job_queued',
              handoffTargetAgentProfileId: agentProfileId,
              runtimeJobId: job.id,
            },
          });
        }
        return job;
      },
    });
  }

  private async resolveDelegatedAgentId(workspaceId: string, agentProfileId?: string, agentName?: string): Promise<string> {
    if (agentProfileId) return agentProfileId;
    if (!agentName) return 'orchestrator';
    const normalized = agentName.trim().toLowerCase();
    if (normalized === 'orchestrator' || normalized === 'team lead' || normalized === 'main agent') {
      return 'orchestrator';
    }
    const agents = await this.agentProfiles.findByWorkspace(workspaceId);
    const match = agents.find((agent) => agent.name.toLowerCase() === normalized);
    return match?.id ?? 'orchestrator';
  }
}
