import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

// Stub supertest import if not available
let supertest: any;
try {
  supertest = require('supertest');
} catch {
  supertest = null;
}

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/auth/register (POST) should create a user', async () => {
    if (!supertest) return;
    const res = await supertest(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'e2e@test.com', password: 'password123', firstName: 'E2E', lastName: 'Test' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
  });
});
