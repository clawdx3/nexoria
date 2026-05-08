import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../../../database/entities/integration.entity';

export interface MailerLiteCredentials {
  apiKey: string;
}

export interface CreateCampaignInput {
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  contentHtml: string;
  contentText?: string;
  groupIds?: string[];
  sendTime?: string;
}

export interface CampaignResult {
  id: string;
  status: 'draft' | 'ready' | 'sent' | 'scheduled';
}

@Injectable()
export class MailerLiteService {
  constructor(
    @InjectRepository(Integration) private readonly integrationRepo: Repository<Integration>,
  ) {}

  private async getIntegration(workspaceId: string): Promise<{ integration: Integration; apiKey: string }> {
    const integration = await this.integrationRepo.findOne({
      where: { workspaceId, type: 'mailerlite', status: 'connected' },
      order: { updatedAt: 'DESC' },
    });
    if (!integration) throw new Error('No connected MailerLite integration found.');
    const creds = integration.credentials as MailerLiteCredentials;
    if (!creds.apiKey) throw new Error('MailerLite API key missing.');
    return { integration, apiKey: creds.apiKey };
  }

  private async mlFetch(workspaceId: string, path: string, opts?: RequestInit): Promise<any> {
    const { apiKey } = await this.getIntegration(workspaceId);
    const res = await fetch(`https://connect.mailerlite.com/api${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(opts?.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      throw new Error(`MailerLite API error: ${body}`);
    }
    return res.json().catch(() => ({}));
  }

  async createCampaign(workspaceId: string, input: CreateCampaignInput): Promise<CampaignResult> {
    const body = await this.mlFetch(workspaceId, '/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        type: 'regular',
        emails: [{
          subject: input.subject,
          from_name: input.fromName,
          from: input.fromEmail,
          content: input.contentHtml,
          plain_text: input.contentText,
        }],
        ...(input.groupIds ? { groups: input.groupIds.map((id) => ({ id })) } : {}),
      }),
    });

    return { id: body.data?.id || body.id, status: body.data?.status || 'draft' };
  }

  async sendCampaign(workspaceId: string, campaignId: string): Promise<CampaignResult> {
    const body = await this.mlFetch(workspaceId, `/campaigns/${campaignId}/send`, { method: 'POST' });
    return { id: campaignId, status: body.data?.status || 'sent' };
  }

  async scheduleCampaign(workspaceId: string, campaignId: string, sendTime: string): Promise<CampaignResult> {
    const body = await this.mlFetch(workspaceId, `/campaigns/${campaignId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ delivery_schedule: sendTime }),
    });
    return { id: campaignId, status: body.data?.status || 'scheduled' };
  }

  async createSubscriber(workspaceId: string, email: string, fields?: Record<string, any>, groupIds?: string[]): Promise<{ id: string }> {
    const body = await this.mlFetch(workspaceId, '/subscribers', {
      method: 'POST',
      body: JSON.stringify({
        email,
        fields,
        ...(groupIds ? { groups: groupIds } : {}),
      }),
    });
    return { id: body.data?.id || body.id };
  }

  async listSubscribers(workspaceId: string, opts: { filter?: string; limit?: number } = {}): Promise<any[]> {
    const qs = new URLSearchParams();
    if (opts.filter) qs.set('filter[status]', opts.filter);
    if (opts.limit) qs.set('limit', String(opts.limit));
    const body = await this.mlFetch(workspaceId, `/subscribers?${qs.toString()}`);
    return body.data || [];
  }

  async listGroups(workspaceId: string): Promise<any[]> {
    const body = await this.mlFetch(workspaceId, '/groups');
    return body.data || [];
  }

  async listCampaigns(workspaceId: string): Promise<any[]> {
    const body = await this.mlFetch(workspaceId, '/campaigns');
    return body.data || [];
  }

  async testCredentials(workspaceId: string): Promise<{ account: string }> {
    const body = await this.mlFetch(workspaceId, '/me');
    return { account: body.data?.email || 'connected' };
  }
}
