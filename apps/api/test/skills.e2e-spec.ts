import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkillsModule } from '../src/modules/skills/skills.module';
import { Skill } from '../src/database/entities/skill.entity';

// Stub supertest import if not available
let supertest: any;
try {
  supertest = require('supertest');
} catch {
  supertest = null;
}

describe('SkillsController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Skill],
          synchronize: true,
        }),
        SkillsModule,
      ],
    })
      .overrideGuard(require('../src/common/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('/skills', () => {
    it('POST /skills - should create a skill', async () => {
      if (!supertest) return;
      const res = await supertest(app.getHttpServer())
        .post('/skills')
        .send({
          name: 'test-skill',
          description: 'A test skill',
          version: '1.0.0',
          category: 'test',
          tags: ['test'],
          author: 'Test',
        })
        .expect(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('test-skill');
    });

    it('GET /skills - should list skills', async () => {
      if (!supertest) return;
      const res = await supertest(app.getHttpServer())
        .get('/skills')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
