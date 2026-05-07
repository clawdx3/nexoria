import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentProfilesService } from './agent-profiles.service';
import { AgentProfilesController } from './agent-profiles.controller';
import { AgentProfile } from '../../database/entities/agent-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AgentProfile])],
  providers: [AgentProfilesService],
  controllers: [AgentProfilesController],
  exports: [AgentProfilesService],
})
export class AgentProfilesModule {}
