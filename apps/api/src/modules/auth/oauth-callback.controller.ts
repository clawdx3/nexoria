import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { ApiTags, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../../database/entities/integration.entity';

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: { message?: string };
}

@ApiTags('OAuth Callbacks')
@Controller('auth')
export class OAuthCallbackController {
  private readonly logger = new Logger(OAuthCallbackController.name);

  constructor(
    @InjectRepository(Integration) private readonly integrationRepo: Repository<Integration>,
  ) {}

  @Get('meta/callback')
  @ApiResponse({ status: 302, description: 'Redirects back to dashboard' })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'state', required: true })
  async metaCallback(
    @Res() res: Response,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
    @Query('error_reason') errorReason?: string,
  ) {
    if (error || !code) {
      this.logger.warn(`Meta OAuth error: ${error} ${errorReason}`);
      return res.redirect(`${process.env.DASHBOARD_URL || 'http://localhost:3000'}/integrations?error=oauth_denied`);
    }

    let decodedState: Record<string, any>;
    try {
      decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch {
      this.logger.error('Invalid OAuth state parameter');
      return res.redirect(`${process.env.DASHBOARD_URL || 'http://localhost:3000'}/integrations?error=invalid_state`);
    }

    const workspaceId = decodedState.workspaceId as string;
    const redirectUri = decodedState.redirectUri || process.env.META_REDIRECT_URI;

    // Exchange code for token
    const qs = new URLSearchParams({
      client_id: process.env.META_APP_ID || '',
      client_secret: process.env.META_APP_SECRET || '',
      redirect_uri: redirectUri || '',
      code,
    });

    const tokenRes = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${qs.toString()}`, {
      method: 'GET',
    });
    const tokenBody = (await tokenRes.json().catch(() => ({}))) as TokenResponse;

    if (!tokenRes.ok || !tokenBody.access_token) {
      this.logger.error(`Meta token exchange failed: ${JSON.stringify(tokenBody)}`);
      return res.redirect(`${process.env.DASHBOARD_URL || 'http://localhost:3000'}/integrations?error=token_exchange`);
    }

    // Save or update Facebook integration
    const existingFb = await this.integrationRepo.findOne({
      where: { workspaceId, type: 'facebook' },
      order: { updatedAt: 'DESC' },
    });

    const creds = { ...(existingFb?.credentials as any || {}), accessToken: tokenBody.access_token };

    if (existingFb) {
      await this.integrationRepo.update(existingFb.id, {
        credentials: creds,
        status: 'connected' as any,
        lastSyncedAt: new Date(),
      });
    } else {
      await this.integrationRepo.save(
        this.integrationRepo.create({
          workspaceId,
          type: 'facebook',
          name: 'Facebook',
          status: 'connected',
          credentials: creds,
        }),
      );
    }

    // Also create Instagram integration placeholder if the token has IG capabilities
    const igExisting = await this.integrationRepo.findOne({
      where: { workspaceId, type: 'instagram' },
      order: { updatedAt: 'DESC' },
    });

    if (!igExisting) {
      await this.integrationRepo.save(
        this.integrationRepo.create({
          workspaceId,
          type: 'instagram',
          name: 'Instagram',
          status: 'pending_selection',
          credentials: { accessToken: tokenBody.access_token },
        }),
      );
    }

    return res.redirect(`${process.env.DASHBOARD_URL || 'http://localhost:3000'}/integrations?success=meta`);
  }

  @Get('google/callback')
  @ApiResponse({ status: 302, description: 'Redirects back to dashboard' })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({ name: 'state', required: true })
  async googleCallback(
    @Res() res: Response,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ) {
    if (error || !code) {
      this.logger.warn(`Google OAuth error: ${error}`);
      return res.redirect(`${process.env.DASHBOARD_URL || 'http://localhost:3000'}/integrations?error=oauth_denied`);
    }

    let decodedState: Record<string, any>;
    try {
      decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch {
      this.logger.error('Invalid OAuth state parameter');
      return res.redirect(`${process.env.DASHBOARD_URL || 'http://localhost:3000'}/integrations?error=invalid_state`);
    }

    const workspaceId = decodedState.workspaceId as string;
    const redirectUri = decodedState.redirectUri || process.env.GOOGLE_REDIRECT_URI;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri || '',
        grant_type: 'authorization_code',
      }),
    });

    const tokenBody = (await tokenRes.json().catch(() => ({}))) as TokenResponse;

    if (!tokenRes.ok || !tokenBody.access_token) {
      this.logger.error(`Google token exchange failed: ${JSON.stringify(tokenBody)}`);
      return res.redirect(`${process.env.DASHBOARD_URL || 'http://localhost:3000'}/integrations?error=token_exchange`);
    }

    const expiresAt = typeof tokenBody.expires_in === 'number'
      ? new Date(Date.now() + tokenBody.expires_in * 1000)
      : undefined;

    const existing = await this.integrationRepo.findOne({
      where: { workspaceId, type: 'gmail' },
      order: { updatedAt: 'DESC' },
    });

    const creds = {
      ...(existing?.credentials as any || {}),
      accessToken: tokenBody.access_token,
      refreshToken: tokenBody.refresh_token,
      expiryDate: typeof tokenBody.expires_in === 'number' ? Date.now() + tokenBody.expires_in * 1000 : undefined,
    };

    if (existing) {
      await this.integrationRepo.update(existing.id, {
        credentials: creds,
        status: 'connected' as any,
        lastSyncedAt: new Date(),
        expiresAt,
      });
    } else {
      await this.integrationRepo.save(
        this.integrationRepo.create({
          workspaceId,
          type: 'gmail',
          name: 'Gmail',
          status: 'connected',
          credentials: creds,
          expiresAt,
        }),
      );
    }

    return res.redirect(`${process.env.DASHBOARD_URL || 'http://localhost:3000'}/integrations?success=gmail`);
  }
}
