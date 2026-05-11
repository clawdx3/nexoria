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
import { AttachmentsService } from '../attachments/attachments.service';
import { TaskPriority, TaskStatus } from '../../database/entities/task.entity';
import { SocialPostDraftStatus, SocialPostPlatform } from '../../database/entities/social-post-draft.entity';
import { MemoryService } from '../memory/memory.service';
import { EmbeddingService } from '../agent-runtime/embedding/embedding.service';
import { MemoryTier, MemoryType } from '../../database/entities/memory-entry.entity';

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
    private readonly attachments: AttachmentsService,
    private readonly config: ConfigService,
    private readonly memoryService: MemoryService,
    private readonly embeddingService: EmbeddingService,
  ) {
    this.registerTaskTools();
    this.registerSocialPostDraftTools();
    this.registerRuntimeDelegationTools();
    this.registerAttachmentTools();
    this.registerMemoryTools();
  }

  authenticate(authHeader: string | undefined): void {
    const expected = this.config.get<string>('NEXORIA_MCP_TOKEN') ?? process.env.NEXORIA_MCP_TOKEN;
    if (!expected) throw new UnauthorizedException('MCP token not configured on server');
    // Some MCP clients append headers multiple times, so the upstream may receive
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
        return this.tasks.update(args.taskId, args.workspaceId, patch);
      },
    });
  }

  private registerSocialPostDraftTools(): void {
    this.tools.set('create_social_post_draft', {
      name: 'create_social_post_draft',
      description: [
        'Canonical Nexoria tool for creating social media post drafts, especially Facebook post drafts.',
        'Use this from delegated content/specialist execution whenever the assigned work is to create, draft, prepare, write, schedule, or publish a Facebook/social post.',
        'The main orchestrator should delegate new social/content creation to agentName "Social Media Agent" with delegate_runtime_job instead of writing final copy or calling this tool directly.',
        'This creates a durable draft record in Nexoria. Do not claim a social post draft was created unless this tool returns successfully.',
        'Default to createReviewTask=true for agent-created social drafts so the user can approve them in Nexoria.',
        'For delegated Social Media Agent work, include metadata.source="social_media_agent_runtime" and metadata.createdByAgentRole="social_media_agent".',
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
    this.tools.set('enqueue_specialist_job', {
      name: 'enqueue_specialist_job',
      description: [
        'Canonical Nexoria tool for handing off background work to a specialist agent. This is a Nexoria-level delegation — never call sessions_spawn or /subagents spawn.',
        'Returns immediately with a queued runtime job. The specialist runs asynchronously; when it finishes, you will receive a follow-up turn in this chat prefixed with "[Nexoria announce]" containing the result. Summarize that result for the user when you see it.',
        'Use this when the orchestrator decides a specialist should work, or when the orchestrator would otherwise do non-trivial work itself.',
        'For social/content work, create a tracking task first with create_task, then call this with agentName "Social Media Agent" and the created taskId.',
        'If the orchestrator itself must do the work, set agentProfileId to "orchestrator" to enqueue a background main-agent run.',
        'Always pass chatSessionId so the announce-back can be routed to this chat. The chatSessionId is provided in your runtime context.',
        'Do not use this for normal conversation or quick answers.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string', description: 'UUID of the active Nexoria workspace. Use the exact workspaceId supplied in the session context.' },
          chatSessionId: { type: 'string', description: 'UUID of the current Nexoria chat session. Use the chatSessionId supplied in the runtime context so the specialist\'s result is announced back to this chat.' },
          agentProfileId: { type: 'string', description: 'Target agent profile id. Use "orchestrator" to spawn a background main-agent run.' },
          agentName: { type: 'string', description: 'Optional target built-in or workspace agent name, e.g. "Social Media Agent". Used when agentProfileId is not known.' },
          taskId: { type: 'string', description: 'Optional Nexoria task id linked to this runtime job.' },
          prompt: { type: 'string', description: 'Clear work instructions for the delegated background agent.' },
          type: { type: 'string', enum: ['create_file', 'research', 'browser_task'], description: 'Runtime job type. Use create_file unless another type is clearly required.' },
          metadata: { type: 'object', description: 'Optional structured handoff metadata.' },
        },
        required: ['workspaceId', 'prompt'],
      },
      execute: async (args) => {
        const agentProfileId = await this.resolveDelegatedAgentId(args.workspaceId, args.agentProfileId, args.agentName);
        const agentName = typeof args.agentName === 'string' ? args.agentName : undefined;
        const normalizedAgentName = agentName?.trim().toLowerCase();
        const isSocialMediaAgent = normalizedAgentName === 'social media agent' || normalizedAgentName === 'content creator';
        const delegatedPrompt = isSocialMediaAgent
          ? [
              'You are Nexoria Social Media Agent working on a delegated background job.',
              `Active Nexoria workspaceId: ${args.workspaceId}`,
              'Write the requested social/content draft yourself, then persist it with the Nexoria MCP create_social_post_draft tool.',
              'For Facebook posts, use platform "facebook". Set createReviewTask=true unless the user explicitly asked for a private draft.',
              'Set metadata.source="social_media_agent_runtime" and metadata.createdByAgentRole="social_media_agent" when creating the draft.',
              'Do not only return the copy in chat; the durable draft and approval are the source of truth.',
              '',
              args.prompt,
            ].join('\n')
          : args.prompt;
        const job = await this.managedRuntime.createJob(args.workspaceId, null, {
          agentProfileId,
          type: args.type ?? 'create_file',
          input: {
            source: 'mcp:enqueue_specialist_job',
            taskId: args.taskId,
            workspaceId: args.workspaceId,
            parentChatSessionId: typeof args.chatSessionId === 'string' ? args.chatSessionId : undefined,
            delegatedAgentName: agentName,
            prompt: delegatedPrompt,
            metadata: {
              ...(args.metadata ?? {}),
              delegatedAgentName: agentName,
              delegatedByTool: 'mcp:enqueue_specialist_job',
              parentChatSessionId: typeof args.chatSessionId === 'string' ? args.chatSessionId : undefined,
            },
          },
        });
        if (args.taskId) {
          const task = await this.tasks.findOne(args.taskId);
          await this.tasks.update(args.taskId, args.workspaceId, {
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

  private registerAttachmentTools(): void {
    this.tools.set('list_attachments', {
      name: 'list_attachments',
      description: 'List durable Nexoria attachments in a workspace. Use this to find files by task, chat session, runtime job, draft, filename, source, uploader, or agent before referring to or refetching a file.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string', description: 'UUID of the active Nexoria workspace.' },
          taskId: { type: 'string' },
          runtimeChatSessionId: { type: 'string' },
          runtimeJobId: { type: 'string' },
          draftId: { type: 'string' },
          filename: { type: 'string' },
          source: { type: 'string', enum: ['user_upload', 'agent_upload', 'runtime', 'reference'] },
          createdByAgentProfileId: { type: 'string' },
          uploadedByUserId: { type: 'string' },
          mimeType: { type: 'string' },
        },
        required: ['workspaceId'],
      },
      execute: async (args) => {
        const attachments = await this.attachments.list(args.workspaceId, {
          taskId: args.taskId,
          runtimeChatSessionId: args.runtimeChatSessionId,
          runtimeJobId: args.runtimeJobId,
          draftId: args.draftId,
          filename: args.filename,
          source: args.source,
          createdByAgentProfileId: args.createdByAgentProfileId,
          uploadedByUserId: args.uploadedByUserId,
          mimeType: args.mimeType,
        });
        return { count: attachments.length, attachments };
      },
    });

    this.tools.set('get_attachment', {
      name: 'get_attachment',
      description: 'Get a durable Nexoria attachment plus a short-lived signed download URL. Use this before reading or reusing a file.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string', description: 'UUID of the active Nexoria workspace.' },
          attachmentId: { type: 'string', description: 'Attachment id returned by Nexoria.' },
        },
        required: ['workspaceId', 'attachmentId'],
      },
      execute: async (args) => {
        const result = await this.attachments.getDownloadUrl(args.workspaceId, args.attachmentId);
        return {
          attachmentId: result.attachment.id,
          filename: result.attachment.filename,
          mimeType: result.attachment.mimeType,
          sizeBytes: result.attachment.sizeBytes,
          scope: result.attachment.scope,
          taskId: result.attachment.taskId,
          runtimeJobId: result.attachment.runtimeJobId,
          downloadUrl: result.downloadUrl,
          downloadUrlExpiresAt: result.expiresAt,
        };
      },
    });

    this.tools.set('create_attachment_reference', {
      name: 'create_attachment_reference',
      description: 'Reference an existing Nexoria attachment from another task, chat, draft, approval, or runtime job without duplicating bytes.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          attachmentId: { type: 'string' },
          scope: { type: 'string', enum: ['chat', 'tasks', 'approvals', 'runtime-jobs', 'drafts', 'general'] },
          scopeId: { type: 'string' },
          taskId: { type: 'string' },
          runtimeChatSessionId: { type: 'string' },
          runtimeJobId: { type: 'string' },
          approvalId: { type: 'string' },
          draftId: { type: 'string' },
          metadata: { type: 'object' },
        },
        required: ['workspaceId', 'attachmentId'],
      },
      execute: async (args) => this.attachments.reference(args.workspaceId, args),
    });

    this.tools.set('upload_attachment', {
      name: 'upload_attachment',
      description: 'Upload agent-generated file bytes into Nexoria managed storage. Use this whenever you create a file that should be durable or visible to the user.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          filename: { type: 'string' },
          mimeType: { type: 'string' },
          contentBase64: { type: 'string', description: 'Base64 encoded file bytes.' },
          createdByAgentProfileId: { type: 'string' },
          taskId: { type: 'string' },
          runtimeChatSessionId: { type: 'string' },
          runtimeJobId: { type: 'string' },
          draftId: { type: 'string' },
          metadata: { type: 'object' },
        },
        required: ['workspaceId', 'filename', 'mimeType', 'contentBase64'],
      },
      execute: async (args) => {
        const bytes = Buffer.from(args.contentBase64, 'base64');
        const attachment = await this.attachments.uploadBytes(args.workspaceId, {
          filename: args.filename,
          mimeType: args.mimeType,
          contentBase64: args.contentBase64,
          sizeBytes: bytes.length,
          source: 'agent_upload',
          taskId: args.taskId,
          runtimeChatSessionId: args.runtimeChatSessionId,
          runtimeJobId: args.runtimeJobId,
          draftId: args.draftId,
          createdByAgentProfileId: args.createdByAgentProfileId,
          metadata: { ...(args.metadata ?? {}), createdByTool: 'mcp:upload_attachment' },
        }, { agentProfileId: args.createdByAgentProfileId });
        return {
          attachmentId: attachment.id,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          scope: attachment.scope,
          taskId: attachment.taskId,
          runtimeJobId: attachment.runtimeJobId,
          downloadUrl: attachment.signedDownloadUrl,
          downloadUrlExpiresAt: attachment.downloadUrlExpiresAt,
        };
      },
    });

    this.tools.set('record_artifact', {
      name: 'record_artifact',
      description: 'Record runtime job output bytes as a Nexoria attachment/artifact. Prefer this for files produced during runtime job execution.',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          filename: { type: 'string' },
          mimeType: { type: 'string' },
          contentBase64: { type: 'string' },
          runtimeJobId: { type: 'string' },
          createdByAgentProfileId: { type: 'string' },
          taskId: { type: 'string' },
          metadata: { type: 'object' },
        },
        required: ['workspaceId', 'filename', 'mimeType', 'contentBase64'],
      },
      execute: async (args) => {
        const bytes = Buffer.from(args.contentBase64, 'base64');
        const attachment = await this.attachments.uploadBytes(args.workspaceId, {
          filename: args.filename,
          mimeType: args.mimeType,
          contentBase64: args.contentBase64,
          sizeBytes: bytes.length,
          source: 'runtime',
          runtimeJobId: args.runtimeJobId,
          taskId: args.taskId,
          createdByAgentProfileId: args.createdByAgentProfileId,
          metadata: { ...(args.metadata ?? {}), createdByTool: 'mcp:record_artifact' },
        }, { agentProfileId: args.createdByAgentProfileId });
        return {
          attachmentId: attachment.id,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          scope: attachment.scope,
          taskId: attachment.taskId,
          runtimeJobId: attachment.runtimeJobId,
          downloadUrl: attachment.signedDownloadUrl,
          downloadUrlExpiresAt: attachment.downloadUrlExpiresAt,
        };
      },
    });
  }

  private registerMemoryTools(): void {
    this.tools.set('create_memory', {
      name: 'create_memory',
      description: [
        'Store a durable memory fact, preference, or pattern in Nexoria for future recall.',
        'Use this whenever the user explicitly asks to remember something, or when you observe a fact worth persisting across sessions.',
        'For facts you expect to need long-term, use tier "long_term" (auto-embeds for semantic search).',
        'For session-only notes, use tier "session". For daily working memory, use tier "daily".',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string', description: 'UUID of the active Nexoria workspace.' },
          content: { type: 'string', description: 'The memory text to store. Be concise and factual.' },
          tier: { type: 'string', enum: ['profile', 'session', 'daily', 'long_term'], description: 'Memory tier. profile=user-wide facts, session=current chat only, daily=recent working memory, long_term=durable semantic memory.' },
          type: { type: 'string', enum: ['fact', 'preference', 'avoidance', 'pattern', 'task_result', 'draft', 'conversation'], description: ' memory type.' },
          userId: { type: 'string', description: 'UUID of the user this memory belongs to.' },
          confidence: { type: 'number', description: 'Optional confidence 0–1. Default 0.9.' },
          sessionId: { type: 'string', description: 'Optional session id when tier is session.' },
        },
        required: ['workspaceId', 'content', 'tier', 'type', 'userId'],
      },
      execute: async (args) => {
        const dto = {
          workspaceId: args.workspaceId,
          userId: args.userId,
          content: args.content,
          tier: args.tier,
          type: args.type,
          sessionId: args.sessionId,
          confidence: typeof args.confidence === 'number' ? args.confidence : 0.9,
          metadata: { source: 'mcp:create_memory' },
        };
        let embedding: number[] | undefined;
        if (dto.tier === 'long_term' && this.embeddingService.isReady()) {
          try {
            embedding = await this.embeddingService.embed(dto.content);
          } catch {
            // silently skip embedding
          }
        }
        return this.memoryService.create(args.workspaceId, dto as any, { embedding });
      },
    });

    this.tools.set('recall_memory', {
      name: 'recall_memory',
      description: [
        'Search Nexoria durable memory by semantic similarity or text match.',
        'Use this when the user asks about something previously discussed or stored, or when you need context about past decisions, preferences, or facts.',
        'For long-term tier semantic search is used automatically; for other tiers a text search is used.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string', description: 'UUID of the active Nexoria workspace.' },
          query: { type: 'string', description: 'Search query describing what you want to recall.' },
          tier: { type: 'string', enum: ['profile', 'session', 'daily', 'long_term'], description: 'Optional tier filter. Omit to search long_term only.' },
          userId: { type: 'string', description: 'UUID of the user to search memories for.' },
          limit: { type: 'number', description: 'Max results. Default 10.' },
        },
        required: ['workspaceId', 'query', 'userId'],
      },
      execute: async (args) => {
        const tier = args.tier ?? 'long_term';
        const limit = args.limit ?? 10;
        if (tier === 'long_term') {
          if (this.embeddingService.isReady()) {
            try {
              const embedding = await this.embeddingService.embed(args.query);
              return await this.memoryService.semanticSearch(args.workspaceId, embedding, limit);
            } catch {
              // fall through to text search if embedding/pgvector path errors
            }
          }
        }
        return this.memoryService.searchByText(args.workspaceId, args.query, limit);
      },
    });
  }

  private async resolveDelegatedAgentId(workspaceId: string, agentProfileId?: string, agentName?: string): Promise<string> {
    const agents = await this.agentProfiles.findEnabledByWorkspace(workspaceId);
    if (agentProfileId) {
      if (agentProfileId === 'orchestrator') return agentProfileId;
      if (!agents.some((agent) => agent.id === agentProfileId)) {
        throw new Error(`Agent ${agentProfileId} is not enabled for this workspace.`);
      }
      return agentProfileId;
    }
    if (!agentName) return 'orchestrator';
    const normalized = agentName.trim().toLowerCase();
    if (normalized === 'orchestrator' || normalized === 'team lead' || normalized === 'main agent') {
      return 'orchestrator';
    }
    const match = agents.find((agent) => {
      const name = agent.name.toLowerCase();
      return name === normalized || (normalized === 'content creator' && name === 'social media agent');
    });
    if (!match) {
      throw new Error(`Agent "${agentName}" is not enabled for this workspace.`);
    }
    return match.id;
  }
}
