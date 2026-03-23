import request from 'supertest';
import { INestApplication } from '@nestjs/common';

import { createTestingApp, ensureRewardsTables, resetRewardsTables } from './setup-e2e';

describe('points adjust e2e', () => {
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

  it('floors monthly points at zero on negative adjustment', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/points/award')
      .set('X-Admin-Id', 'admin-1')
      .send({
        playerId: 'p2-uuid-0002',
        bigBlind: 2,
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/admin/points/adjust')
      .set('X-Admin-Id', 'admin-1')
      .send({
        playerId: 'p2-uuid-0002',
        points: -999,
        reason: 'test correction',
      })
      .expect(200);

    expect(response.body.monthlyPoints).toBe(0);
    expect(response.body.lifetimePoints).toBe(0);
  });
});
