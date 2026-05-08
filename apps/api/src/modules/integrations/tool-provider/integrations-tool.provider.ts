import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { z } from 'zod';
import { ToolRegistryService } from '../../agent-runtime/tool-registry/tool-registry.service';
import { MetaApiService } from '../providers/meta-api.service';
import { GmailApiService } from '../providers/gmail-api.service';
import { MailerLiteService } from '../providers/mailerlite.service';

@Injectable()
export class IntegrationsToolProvider implements OnModuleInit {
  private readonly logger = new Logger(IntegrationsToolProvider.name);

  constructor(
    private readonly meta: MetaApiService,
    private readonly gmail: GmailApiService,
    private readonly mailerlite: MailerLiteService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onModuleInit(): void {
    const registry = this.moduleRef.get(ToolRegistryService, { strict: false });
    if (!registry) {
      this.logger.warn('ToolRegistryService not available — integration tools will not be registered');
      return;
    }

    // ── Facebook ──────────────────────────────────────────────
    registry.register({
      name: 'facebook_post',
      description: 'Publish a post to the connected Facebook page.',
      schema: z.object({
        text: z.string().describe('Post message body'),
        imageUrl: z.string().optional().describe('Optional public image URL to attach'),
      }),
      riskLevel: 3,
      execute: async (args, ctx) => {
        const result = await this.meta.postToFacebook(ctx.workspaceId, args.text, args.imageUrl);
        return { success: true, ...result };
      },
    });

    registry.register({
      name: 'facebook_list_pages',
      description: 'List Facebook pages available via the connected account.',
      schema: z.object({}),
      riskLevel: 1,
      execute: async (_args, ctx) => {
        const pages = await this.meta.fetchPages(ctx.workspaceId);
        return { success: true, pages };
      },
    });

    // ── Instagram ───────────────────────────────────────────────
    registry.register({
      name: 'instagram_post',
      description: 'Publish an image post to the connected Instagram business account.',
      schema: z.object({
        caption: z.string().describe('Post caption'),
        imageUrl: z.string().describe('Public image URL (required for Instagram)'),
      }),
      riskLevel: 3,
      execute: async (args, ctx) => {
        const result = await this.meta.postToInstagram(ctx.workspaceId, args.caption, args.imageUrl);
        return { success: true, ...result };
      },
    });

    // ── Gmail ─────────────────────────────────────────────────
    registry.register({
      name: 'gmail_list_messages',
      description: 'List recent emails from the connected Gmail account.',
      schema: z.object({
        query: z.string().optional().describe('Gmail search query (same syntax as Gmail search bar)'),
        maxResults: z.number().optional().describe('Max results to return (default 20)'),
        labelIds: z.array(z.string()).optional().describe('Filter by label IDs'),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        const messages = await this.gmail.listMessages(ctx.workspaceId, {
          query: args.query,
          maxResults: args.maxResults,
          labelIds: args.labelIds,
        });
        return { success: true, count: messages.length, messages: messages.map((m) => ({ id: m.id, subject: m.subject, from: m.from, date: m.date, snippet: m.snippet, labels: m.labels })) };
      },
    });

    registry.register({
      name: 'gmail_get_message',
      description: 'Get full email content by message ID.',
      schema: z.object({
        messageId: z.string().describe('Gmail message ID'),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        const message = await this.gmail.getMessage(ctx.workspaceId, args.messageId);
        return { success: true, message };
      },
    });

    registry.register({
      name: 'gmail_send_email',
      description: 'Send an email directly from the connected Gmail account.',
      schema: z.object({
        to: z.string().describe('Recipient email address'),
        subject: z.string(),
        body: z.string().describe('Plain text body'),
        threadId: z.string().optional(),
      }),
      riskLevel: 3,
      execute: async (args, ctx) => {
        const result = await this.gmail.sendEmail(ctx.workspaceId, args.to, args.subject, args.body, args.threadId);
        return { success: true, ...result };
      },
    });

    registry.register({
      name: 'gmail_create_draft',
      description: 'Create a Gmail draft.',
      schema: z.object({
        to: z.string(),
        subject: z.string(),
        body: z.string().describe('Plain text body'),
        threadId: z.string().optional(),
      }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        const result = await this.gmail.createDraft(ctx.workspaceId, args.to, args.subject, args.body, args.threadId);
        return { success: true, ...result };
      },
    });

    registry.register({
      name: 'gmail_get_labels',
      description: 'List Gmail labels for the connected account.',
      schema: z.object({}),
      riskLevel: 1,
      execute: async (_args, ctx) => {
        const labels = await this.gmail.getLabels(ctx.workspaceId);
        return { success: true, labels };
      },
    });

    registry.register({
      name: 'gmail_add_labels',
      description: 'Add labels to a Gmail message.',
      schema: z.object({
        messageId: z.string(),
        labelIds: z.array(z.string()).describe('Label IDs to add'),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        await this.gmail.addLabels(ctx.workspaceId, args.messageId, args.labelIds);
        return { success: true };
      },
    });

    // ── MailerLite ────────────────────────────────────────────
    registry.register({
      name: 'mailerlite_create_campaign',
      description: 'Create a MailerLite email campaign draft.',
      schema: z.object({
        name: z.string().describe('Campaign name (internal)'),
        subject: z.string(),
        fromName: z.string(),
        fromEmail: z.string(),
        contentHtml: z.string().describe('HTML email body'),
        contentText: z.string().optional().describe('Plain text fallback'),
        groupIds: z.array(z.string()).optional().describe('MailerLite group IDs to send to'),
        sendTime: z.string().optional().describe('ISO 8601 datetime for scheduling'),
      }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        const result = await this.mailerlite.createCampaign(ctx.workspaceId, args);
        return { success: true, ...result };
      },
    });

    registry.register({
      name: 'mailerlite_send_campaign',
      description: 'Send a MailerLite campaign immediately.',
      schema: z.object({
        campaignId: z.string(),
      }),
      riskLevel: 3,
      execute: async (args, ctx) => {
        const result = await this.mailerlite.sendCampaign(ctx.workspaceId, args.campaignId);
        return { success: true, ...result };
      },
    });

    registry.register({
      name: 'mailerlite_schedule_campaign',
      description: 'Schedule a MailerLite campaign for a specific time.',
      schema: z.object({
        campaignId: z.string(),
        sendTime: z.string().describe('ISO 8601 datetime'),
      }),
      riskLevel: 2,
      execute: async (args, ctx) => {
        const result = await this.mailerlite.scheduleCampaign(ctx.workspaceId, args.campaignId, args.sendTime);
        return { success: true, ...result };
      },
    });

    registry.register({
      name: 'mailerlite_create_subscriber',
      description: 'Add a subscriber to MailerLite.',
      schema: z.object({
        email: z.string().email(),
        fields: z.record(z.any()).optional(),
        groupIds: z.array(z.string()).optional(),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        const result = await this.mailerlite.createSubscriber(ctx.workspaceId, args.email, args.fields, args.groupIds);
        return { success: true, ...result };
      },
    });

    registry.register({
      name: 'mailerlite_list_subscribers',
      description: 'List MailerLite subscribers.',
      schema: z.object({
        filter: z.string().optional().describe('Filter by status, e.g. "active"/"unsubscribed"'),
        limit: z.number().optional(),
      }),
      riskLevel: 1,
      execute: async (args, ctx) => {
        const subscribers = await this.mailerlite.listSubscribers(ctx.workspaceId, { filter: args.filter, limit: args.limit });
        return { success: true, subscribers };
      },
    });

    registry.register({
      name: 'mailerlite_list_groups',
      description: 'List MailerLite groups.',
      schema: z.object({}),
      riskLevel: 1,
      execute: async (_args, ctx) => {
        const groups = await this.mailerlite.listGroups(ctx.workspaceId);
        return { success: true, groups };
      },
    });

    this.logger.log('Registered 14 integration tools (Facebook, Instagram, Gmail, MailerLite)');
  }
}
