import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaybooksService } from './playbooks.service';
import { PlaybooksController } from './playbooks.controller';
import { Playbook } from '../../database/entities/playbook.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Playbook])],
  providers: [PlaybooksService],
  controllers: [PlaybooksController],
  exports: [PlaybooksService],
})
export class PlaybooksModule {}
