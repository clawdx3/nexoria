import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { Workspace } from '../../database/entities/workspace.entity';
import { WorkspaceMember } from '../../database/entities/workspace-member.entity';
import { Invitation } from '../../database/entities/invitation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Workspace, WorkspaceMember, Invitation])],
  providers: [WorkspacesService],
  controllers: [WorkspacesController],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
