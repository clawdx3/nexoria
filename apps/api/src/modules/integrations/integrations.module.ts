import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { Integration } from '../../database/entities/integration.entity';
import { MetaApiService } from './providers/meta-api.service';
import { GmailApiService } from './providers/gmail-api.service';
import { MailerLiteService } from './providers/mailerlite.service';
import { IntegrationsToolProvider } from './tool-provider/integrations-tool.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Integration])],
  providers: [
    IntegrationsService,
    MetaApiService,
    GmailApiService,
    MailerLiteService,
    IntegrationsToolProvider,
  ],
  controllers: [IntegrationsController],
  exports: [IntegrationsService, MetaApiService, GmailApiService, MailerLiteService],
})
export class IntegrationsModule {}
