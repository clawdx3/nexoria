import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Playbook } from '../../database/entities/playbook.entity';
import { CreatePlaybookDto, UpdatePlaybookDto, PlaybookResponseDto } from './dto/create-playbook.dto';

@Injectable()
export class PlaybooksService {
  constructor(@InjectRepository(Playbook) private readonly repo: Repository<Playbook>) {}

  async create(workspaceId: string, dto: CreatePlaybookDto): Promise<PlaybookResponseDto> {
    const playbook = this.repo.create({
      workspaceId,
      name: dto.name,
      description: dto.description,
      steps: dto.steps,
      triggers: dto.triggers ?? {},
      variables: dto.variables ?? {},
      isBuiltIn: false,
      isActive: true,
    });
    const saved = await this.repo.save(playbook);
    return this.toDto(saved);
  }

  async findOne(id: string): Promise<PlaybookResponseDto> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Playbook not found');
    return this.toDto(p);
  }

  async findByWorkspace(workspaceId: string): Promise<PlaybookResponseDto[]> {
    const items = await this.repo.find({ where: { workspaceId }, order: { createdAt: 'DESC' } });
    return items.map((i) => this.toDto(i));
  }

  async update(id: string, dto: UpdatePlaybookDto): Promise<PlaybookResponseDto> {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  private toDto(p: Playbook): PlaybookResponseDto {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      steps: p.steps,
      isActive: p.isActive,
      createdAt: p.createdAt,
    };
  }
}
