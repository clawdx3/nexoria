import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Approval } from '../../database/entities/approval.entity';
import { SocialPostDraft } from '../../database/entities/social-post-draft.entity';
import { TasksModule } from '../tasks/tasks.module';
import { SocialPostDraftsController } from './social-post-drafts.controller';
import { SocialPostDraftsService } from './social-post-drafts.service';

@Module({
  imports: [TypeOrmModule.forFeature([SocialPostDraft, Approval]), TasksModule],
  providers: [SocialPostDraftsService],
  controllers: [SocialPostDraftsController],
  exports: [SocialPostDraftsService],
})
export class SocialPostDraftsModule {}
