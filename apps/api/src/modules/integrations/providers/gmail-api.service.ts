import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../../../database/entities/integration.entity';
import { google } from 'googleapis';

export interface GmailCredentials {
  accessToken: string;
  refreshToken: string;
  expiryDate?: number;
  emailAddress?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: any;
  subject: string;
  from: string;
  date: string;
  bodyText: string;
  labels: string[];
}

export interface DraftResult {
  id: string;
  messageId: string;
}

@Injectable()
export class GmailApiService {
  constructor(
    @InjectRepository(Integration) private readonly integrationRepo: Repository<Integration>,
  ) {}

  private async getIntegration(workspaceId: string): Promise<Integration | null> {
    return this.integrationRepo.findOne({
      where: { workspaceId, type: 'gmail', status: 'connected' },
      order: { updatedAt: 'DESC' },
    });
  }

  private async getAuthClient(workspaceId: string) {
    const integration = await this.getIntegration(workspaceId);
    if (!integration) throw new Error('No connected Gmail integration found.');
    const creds = integration.credentials as GmailCredentials;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.API_BASE_URL}/auth/google/callback`,
    );

    oauth2Client.setCredentials({
      access_token: creds.accessToken,
      refresh_token: creds.refreshToken,
      expiry_date: creds.expiryDate,
    });

    return { oauth2Client, creds, integration };
  }

  async listMessages(workspaceId: string, opts: {
    maxResults?: number;
    query?: string;
    labelIds?: string[];
  } = {}): Promise<GmailMessage[]> {
    const { oauth2Client } = await this.getAuthClient(workspaceId);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: opts.maxResults ?? 20,
      q: opts.query || '',
      labelIds: opts.labelIds || [],
    });

    const messages = res.data.messages || [];
    if (messages.length === 0) return [];

    const fullMessages = await Promise.all(
      messages.map(async (m) => {
        if (!m.id) return null;
        const detail = await gmail.users.messages.get({ userId: 'me', id: m.id });
        const msg = detail.data;
        const headers = (msg.payload?.headers || []) as any[];
        const getHeader = (name: string) => headers.find((h) => h.name === name)?.value || '';

        let bodyText = '';
        const parts = msg.payload?.parts || [msg.payload];
        for (const part of parts) {
          if (!part) continue;
          if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
            bodyText += part.body?.data
              ? Buffer.from(part.body.data, 'base64').toString('utf-8')
              : '';
          }
        }

        return {
          id: msg.id!,
          threadId: msg.threadId!,
          snippet: msg.snippet || '',
          payload: msg.payload,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          date: getHeader('Date'),
          bodyText,
          labels: msg.labelIds || [],
        };
      }),
    );

    return fullMessages.filter((m): m is GmailMessage => m !== null);
  }

  async getMessage(workspaceId: string, messageId: string): Promise<GmailMessage> {
    const { oauth2Client } = await this.getAuthClient(workspaceId);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const detail = await gmail.users.messages.get({ userId: 'me', id: messageId });
    const msg = detail.data;
    const headers = (msg.payload?.headers || []) as any[];
    const getHeader = (name: string) => headers.find((h) => h.name === name)?.value || '';

    let bodyText = '';
    const parts = msg.payload?.parts || [msg.payload];
    for (const part of parts) {
      if (!part) continue;
      if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
        bodyText += part.body?.data
          ? Buffer.from(part.body.data, 'base64').toString('utf-8')
          : '';
      }
    }

    return {
      id: msg.id!,
      threadId: msg.threadId!,
      snippet: msg.snippet || '',
      payload: msg.payload,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      date: getHeader('Date'),
      bodyText,
      labels: msg.labelIds || [],
    };
  }

  async createDraft(workspaceId: string, to: string, subject: string, body: string, threadId?: string): Promise<DraftResult> {
    const { oauth2Client } = await this.getAuthClient(workspaceId);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const raw = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body,
    ].join('\r\n');

    const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const res = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: encoded,
          ...(threadId ? { threadId } : {}),
        },
      },
    });

    return { id: res.data.id!, messageId: res.data.message?.id || '' };
  }

  async sendEmail(workspaceId: string, to: string, subject: string, body: string, threadId?: string): Promise<{ id: string }> {
    const { oauth2Client } = await this.getAuthClient(workspaceId);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const raw = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body,
    ].join('\r\n');

    const encoded = Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded, ...(threadId ? { threadId } : {}) },
    });

    return { id: res.data.id! };
  }

  async addLabels(workspaceId: string, messageId: string, labelIds: string[]): Promise<void> {
    const { oauth2Client } = await this.getAuthClient(workspaceId);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: { addLabelIds: labelIds },
    });
  }

  async getLabels(workspaceId: string): Promise<{ id: string; name: string }[]> {
    const { oauth2Client } = await this.getAuthClient(workspaceId);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const res = await gmail.users.labels.list({ userId: 'me' });
    return (res.data.labels || []).map((l) => ({ id: l.id!, name: l.name! }));
  }
}
