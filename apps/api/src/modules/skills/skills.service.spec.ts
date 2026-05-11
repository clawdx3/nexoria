import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillsService } from './skills.service';
import { Skill } from '../../database/entities/skill.entity';

describe('SkillsService', () => {
  let service: SkillsService;
  let repo: jest.Mocked<Repository<Skill>>;

  const mockSkill: Skill = {
    id: 'skill-1',
    name: 'email-sender',
    description: 'Send emails via SMTP',
    version: '1.0.0',
    category: 'communication',
    tags: ['email', 'smtp'],
    author: 'Nexoria',
    configSchema: { host: { type: 'string' } },
    tools: ['send_email', 'validate_email'],
    metadata: { icon: 'mail' },
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockRepo = {
    create: jest.fn().mockReturnValue(mockSkill),
    save: jest.fn().mockResolvedValue(mockSkill),
    find: jest.fn().mockResolvedValue([mockSkill]),
    findOne: jest.fn().mockResolvedValue(mockSkill),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        {
          provide: getRepositoryToken(Skill),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
    repo = module.get(getRepositoryToken(Skill));

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a skill', async () => {
      const dto = {
        name: 'email-sender',
        description: 'Send emails via SMTP',
        version: '1.0.0',
        category: 'communication',
        tags: ['email', 'smtp'],
        author: 'Nexoria',
        configSchema: { host: { type: 'string' } },
        tools: ['send_email', 'validate_email'],
        metadata: { icon: 'mail' },
      };

      const result = await service.create(dto);

      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(result.id).toBe('skill-1');
      expect(result.name).toBe('email-sender');
    });
  });

  describe('findAll', () => {
    it('should return all skills', async () => {
      const result = await service.findAll();

      expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('email-sender');
    });
  });

  describe('findOne', () => {
    it('should return a skill by id', async () => {
      const result = await service.findOne('skill-1');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'skill-1' } });
      expect(result).not.toBeNull();
      expect(result?.id).toBe('skill-1');
    });

    it('should return null for non-existent skill', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      const result = await service.findOne('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a skill', async () => {
      const dto = { name: 'email-sender-v2' };
      const result = await service.update('skill-1', dto);

      expect(repo.update).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });

    it('should return null for non-existent skill', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      const result = await service.update('non-existent', { name: 'test' });
      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should remove a skill', async () => {
      const result = await service.remove('skill-1');
      expect(result).toBe(true);
      expect(repo.delete).toHaveBeenCalledWith('skill-1');
    });
  });
});
