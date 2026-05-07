import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { Integration } from '../../database/entities/integration.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Integration])],
  providers: [IntegrationsService],
  controllers: [IntegrationsController],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
