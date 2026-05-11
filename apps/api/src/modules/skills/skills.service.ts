import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Skill } from '../../database/entities/skill.entity';
import { CreateSkillDto, SkillResponseDto } from './dto/create-skill.dto';

@Injectable()
export class SkillsService {
  constructor(
    @InjectRepository(Skill) private readonly repo: Repository<Skill>,
  ) {}

  async create(dto: CreateSkillDto): Promise<SkillResponseDto> {
    const skill = this.repo.create({
      name: dto.name,
      description: dto.description ?? '',
      version: dto.version,
      category: dto.category,
      tags: dto.tags ?? [],
      author: dto.author,
      configSchema: dto.configSchema ?? null,
      tools: dto.tools ?? [],
      metadata: dto.metadata ?? null,
    });
    const saved = await this.repo.save(skill);
    return this.toDto(saved);
  }

  async findAll(): Promise<SkillResponseDto[]> {
    const skills = await this.repo.find({ order: { createdAt: 'DESC' } });
    return skills.map((s) => this.toDto(s));
  }

  async findOne(id: string): Promise<SkillResponseDto | null> {
    const skill = await this.repo.findOne({ where: { id } });
    return skill ? this.toDto(skill) : null;
  }

  async update(id: string, dto: Partial<CreateSkillDto>): Promise<SkillResponseDto | null> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) return null;
    await this.repo.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.version !== undefined && { version: dto.version }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...(dto.tags !== undefined && { tags: dto.tags }),
      ...(dto.author !== undefined && { author: dto.author }),
      ...(dto.configSchema !== undefined && { configSchema: dto.configSchema }),
      ...(dto.tools !== undefined && { tools: dto.tools }),
      ...(dto.metadata !== undefined && { metadata: dto.metadata }),
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  private toDto(skill: Skill): SkillResponseDto {
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      version: skill.version,
      category: skill.category,
      tags: skill.tags ?? [],
      author: skill.author,
      configSchema: skill.configSchema ?? null,
      tools: skill.tools ?? [],
      metadata: skill.metadata ?? null,
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
    };
  }
}
