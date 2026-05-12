import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VpsProvisioningService } from './vps-provisioning.service';
import { VpsProvisioningController } from './vps-provisioning.controller';
import { VpsInstance } from '../../database/entities/vps-instance.entity';
import { HetznerAdapter } from './providers/hetzner.adapter';

@Module({
  imports: [TypeOrmModule.forFeature([VpsInstance])],
  providers: [VpsProvisioningService, HetznerAdapter],
  controllers: [VpsProvisioningController],
  exports: [VpsProvisioningService],
})
export class VpsProvisioningModule {}
