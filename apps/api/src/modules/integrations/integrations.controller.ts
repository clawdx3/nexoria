import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { MetaApiService } from './providers/meta-api.service';
import { GmailApiService } from './providers/gmail-api.service';
import { MailerLiteService } from './providers/mailerlite.service';
import { CreateIntegrationDto, UpdateIntegrationDto, IntegrationResponseDto } from './dto/create-integration.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../../shared/interfaces/authenticated-request.interface';
import { IsOptional, IsString, IsArray } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class ConnectMailerLiteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey?: string;
}

class SelectPageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pageName?: string;
}

class SelectInstagramDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountId?: string;
}

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/integrations')
export class IntegrationsController {
  constructor(
    private readonly service: IntegrationsService,
    private readonly metaApi: MetaApiService,
    private readonly gmailApi: GmailApiService,
    private readonly mailerLite: MailerLiteService,
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────

  @Get()
  @ApiResponse({ status: 200, type: [IntegrationResponseDto] })
  findByWorkspace(@Param('workspaceId') wsId: string): Promise<IntegrationResponseDto[]> {
    return this.service.findByWorkspace(wsId);
  }

  @Get(':id')
  @ApiResponse({ status: 200, type: IntegrationResponseDto })
  findOne(@Param('id') id: string): Promise<IntegrationResponseDto> {
    return this.service.findOne(id);
  }

  @Post()
  @ApiResponse({ status: 201, type: IntegrationResponseDto })
  create(@Param('workspaceId') wsId: string, @Body() dto: CreateIntegrationDto): Promise<IntegrationResponseDto> {
    return this.service.create(wsId, dto);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: IntegrationResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateIntegrationDto): Promise<IntegrationResponseDto> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiResponse({ status: 204 })
  remove(@Param('id') id: string): Promise<void> {
    return this.service.remove(id);
  }

  // ── OAuth: redirect URLs ─────────────────────────────────────

  @Get('facebook/connect-url')
  @ApiResponse({ status: 200, description: 'Facebook OAuth URL' })
  @ApiQuery({ name: 'redirectUri', required: false })
  facebookConnectUrl(
    @Param('workspaceId') wsId: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    const clientId = process.env.META_APP_ID;
    const baseRedirect = process.env.META_REDIRECT_URI || `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/v1/auth/meta/callback`;
    const redirect = redirectUri || baseRedirect;
    const state = Buffer.from(JSON.stringify({ workspaceId: wsId, redirectUri: redirect })).toString('base64');
    const scopes = 'pages_manage_posts,instagram_basic,instagram_content_publish,email';
    const url = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;
    return { url };
  }

  @Get('gmail/connect-url')
  @ApiResponse({ status: 200, description: 'Gmail OAuth URL' })
  @ApiQuery({ name: 'redirectUri', required: false })
  gmailConnectUrl(
    @Param('workspaceId') wsId: string,
    @Query('redirectUri') redirectUri?: string,
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const baseRedirect = process.env.GOOGLE_REDIRECT_URI || `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/v1/auth/google/callback`;
    const redirect = redirectUri || baseRedirect;
    const state = Buffer.from(JSON.stringify({ workspaceId: wsId, redirectUri: redirect })).toString('base64');
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ].join(' ');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
    return { url };
  }

  // ── Meta page selection ───────────────────────────────────────

  @Post('facebook/pages')
  @ApiResponse({ status: 200 })
  async listFacebookPages(@Param('workspaceId') wsId: string) {
    const pages = await this.metaApi.fetchPages(wsId);
    return { pages };
  }

  @Post('facebook/select-page')
  @ApiResponse({ status: 200 })
  async selectFacebookPage(
    @Param('workspaceId') wsId: string,
    @Body() body: SelectPageDto,
  ) {
    return this.service.selectFacebookPage(wsId, body.pageId, body.pageName);
  }

  @Get('instagram/accounts')
  @ApiResponse({ status: 200 })
  async listInstagramAccounts(
    @Param('workspaceId') wsId: string,
    @Query('pageId') pageId: string,
  ) {
    const accounts = await this.metaApi.fetchInstagramAccounts(wsId, pageId);
    return { accounts };
  }

  @Post('instagram/select-account')
  @ApiResponse({ status: 200 })
  async selectInstagramAccount(
    @Param('workspaceId') wsId: string,
    @Body() body: SelectInstagramDto,
  ) {
    return this.service.selectInstagramAccount(wsId, body.pageId, body.accountId);
  }

  // ── MailerLite API key ───────────────────────────────────────

  @Post('mailerlite/connect')
  @ApiResponse({ status: 201 })
  async connectMailerLite(
    @Param('workspaceId') wsId: string,
    @Body() body: ConnectMailerLiteDto,
  ) {
    await this.mailerLite.testCredentials(wsId);
    return this.service.create(wsId, {
      type: 'mailerlite',
      name: 'MailerLite',
      credentials: { apiKey: body.apiKey },
    });
  }
}
