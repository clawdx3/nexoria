import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissionsService } from './missions.service';
import { MissionsController } from './missions.controller';
import { Mission } from '../../database/entities/mission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Mission])],
  providers: [MissionsService],
  controllers: [MissionsController],
  exports: [MissionsService],
})
export class MissionsModule {}
