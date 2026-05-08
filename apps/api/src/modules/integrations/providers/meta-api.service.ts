import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration, IntegrationType } from '../../../database/entities/integration.entity';

export interface MetaCredentials {
  accessToken: string;
  pageId?: string;
  pageName?: string;
  instagramAccountId?: string;
  expiresAt?: number;
}

export interface PostToPageResult {
  id: string;
  postId: string;
}

export interface PostToInstagramResult {
  id: string;
  creationId: string;
  status: 'published' | 'processing';
}

@Injectable()
export class MetaApiService {
  private readonly graphBase = 'https://graph.facebook.com/v18.0';

  constructor(
    @InjectRepository(Integration) private readonly integrationRepo: Repository<Integration>,
  ) {}

  private async getIntegration(workspaceId: string, type: IntegrationType): Promise<Integration | null> {
    return this.integrationRepo.findOne({
      where: { workspaceId, type, status: 'connected' },
      order: { updatedAt: 'DESC' },
    });
  }

  private async apiCall(path: string, token: string, opts?: RequestInit): Promise<any> {
    const url = `${this.graphBase}${path}`;
    const res = await fetch(url, {
      ...opts,
      headers: {
        ...(opts?.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Meta API error: ${body?.error?.message || res.statusText}`);
    }
    return body;
  }

  async postToFacebook(workspaceId: string, text: string, imageUrl?: string): Promise<PostToPageResult> {
    const integration = await this.getIntegration(workspaceId, 'facebook');
    if (!integration) throw new Error('No connected Facebook integration found.');
    const creds = integration.credentials as MetaCredentials;
    if (!creds.pageId) throw new Error('Facebook page ID not configured.');

    if (imageUrl) {
      const body = await this.apiCall(
        `/${creds.pageId}/photos?url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(text)}`,
        creds.accessToken,
        { method: 'POST' },
      );
      return { id: body.post_id || body.id, postId: body.post_id || body.id };
    }

    const body = await this.apiCall(
      `/${creds.pageId}/feed?message=${encodeURIComponent(text)}`,
      creds.accessToken,
      { method: 'POST' },
    );
    return { id: body.post_id || body.id, postId: body.post_id || body.id };
  }

  async postToInstagram(workspaceId: string, caption: string, imageUrl: string): Promise<PostToInstagramResult> {
    const integration = await this.getIntegration(workspaceId, 'instagram');
    if (!integration) throw new Error('No connected Instagram integration found.');
    const creds = integration.credentials as MetaCredentials;
    if (!creds.instagramAccountId) throw new Error('Instagram account ID not configured.');

    // Step 1: Upload image to media container
    const mediaBody = await this.apiCall(
      `/${creds.instagramAccountId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}&access_token=${creds.accessToken}`,
      creds.accessToken,
      { method: 'POST' },
    );
    const creationId = mediaBody.id;

    // Step 2: Publish the container
    const publishBody = await this.apiCall(
      `/${creds.instagramAccountId}/media_publish?creation_id=${creationId}&access_token=${creds.accessToken}`,
      creds.accessToken,
      { method: 'POST' },
    );

    return { id: publishBody.id, creationId, status: 'published' };
  }

  async fetchPages(workspaceId: string): Promise<{ id: string; name: string }[]> {
    const integration = await this.getIntegration(workspaceId, 'facebook');
    if (!integration) return [];
    const creds = integration.credentials as MetaCredentials;

    const body = await this.apiCall('/me/accounts', creds.accessToken);
    return (body.data || []).map((p: any) => ({ id: p.id, name: p.name }));
  }

  async fetchInstagramAccounts(workspaceId: string, pageId: string): Promise<{ id: string; username: string }[]> {
    const integration = await this.getIntegration(workspaceId, 'facebook');
    if (!integration) return [];
    const creds = integration.credentials as MetaCredentials;

    const body = await this.apiCall(`/${pageId}?fields=instagram_business_account`, creds.accessToken);
    if (!body.instagram_business_account) return [];
    return [{ id: body.instagram_business_account.id, username: body.instagram_business_account?.username || '' }];
  }
}
