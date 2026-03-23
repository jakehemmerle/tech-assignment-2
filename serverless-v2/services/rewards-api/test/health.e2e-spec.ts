import request from 'supertest';
import { INestApplication } from '@nestjs/common';

import { createTestingApp, ensureRewardsTables, resetRewardsTables } from './setup-e2e';

describe('health e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await ensureRewardsTables();
    app = await createTestingApp();
  });

  beforeEach(async () => {
    await resetRewardsTables();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns service metadata', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body.service).toBe('rewards-api');
    expect(response.body.status).toBe('ok');
    expect(response.body.timestamp).toBeDefined();
  });
});
