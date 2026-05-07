import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import * as bcrypt from 'bcryptjs';

const mockRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockJwt = { sign: jest.fn(() => 'token') };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should register a user', async () => {
    mockRepo.findOne.mockResolvedValue(null);
    mockRepo.create.mockReturnValue({ id: 'u1', email: 'a@b.com' });
    mockRepo.save.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    const dto = { email: 'a@b.com', password: 'pass123', firstName: 'A', lastName: 'B' };
    const result = await service.register(dto as any);
    expect(result.id).toBe('u1');
  });

  it('should login and return token', async () => {
    const hash = await bcrypt.hash('pass123', 10);
    mockRepo.findOne.mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash: hash });
    const result = await service.login({ email: 'a@b.com', password: 'pass123' });
    expect(result.accessToken).toBe('token');
  });
});
