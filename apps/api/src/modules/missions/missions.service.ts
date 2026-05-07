import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mission, MissionStatus } from '../../database/entities/mission.entity';
import { CreateMissionDto, UpdateMissionDto, MissionResponseDto } from './dto/create-mission.dto';

@Injectable()
export class MissionsService {
  constructor(@InjectRepository(Mission) private readonly repo: Repository<Mission>) {}

  async create(workspaceId: string, dto: CreateMissionDto): Promise<MissionResponseDto> {
    const mission = this.repo.create({
      workspaceId,
      name: dto.name,
      description: dto.description,
      parentTaskId: dto.parentTaskId,
      context: dto.context ?? {},
    });
    const saved = await this.repo.save(mission);
    return this.toDto(saved);
  }

  async findOne(id: string): Promise<MissionResponseDto> {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Mission not found');
    return this.toDto(m);
  }

  async findByWorkspace(workspaceId: string): Promise<MissionResponseDto[]> {
    const items = await this.repo.find({ where: { workspaceId }, order: { createdAt: 'DESC' } });
    return items.map((i) => this.toDto(i));
  }

  async update(id: string, dto: UpdateMissionDto): Promise<MissionResponseDto> {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private toDto(m: Mission): MissionResponseDto {
    return {
      id: m.id,
      workspaceId: m.workspaceId,
      name: m.name,
      status: m.status,
      createdAt: m.createdAt,
    };
  }
}
