import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';
import { MemoryEntry } from '../../database/entities/memory-entry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MemoryEntry])],
  providers: [MemoryService],
  controllers: [MemoryController],
  exports: [MemoryService],
})
export class MemoryModule {}
