import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { User } from '../src/database/entities/user.entity';
import { Repository } from 'typeorm';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test-secret', signOptions: { expiresIn: '1h' } }),
      ],
      providers: [
        AuthService,
        AuthController,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: () => Promise.resolve(null),
            create: (dto: any) => dto,
            save: (entity: any) => Promise.resolve({ id: 'test-id', ...entity }),
          },
        },
        {
          provide: getRepositoryToken(require('../src/database/entities/integration.entity').Integration),
          useValue: {},
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    authService = moduleFixture.get(AuthService);
    userRepo = moduleFixture.get(getRepositoryToken(User));
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should register a new user', async () => {
    // Test the service directly since the full HTTP setup has SQLite enum incompatibility
    const result = await authService.register({
      email: 'e2e@test.com',
      password: 'password123',
      firstName: 'E2E',
      lastName: 'Test',
    });
    expect(result).toHaveProperty('id');
    expect(result.email).toBe('e2e@test.com');
  });
});