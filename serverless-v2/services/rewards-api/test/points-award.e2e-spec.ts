import request from 'supertest';
import { INestApplication } from '@nestjs/common';

import { createTestingApp, ensureRewardsTables, resetRewardsTables } from './setup-e2e';

describe('points award e2e', () => {
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

  it('awards points to a new player', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/points/award')
      .set('X-Admin-Id', 'admin-1')
      .send({
        playerId: 'p1-uuid-0001',
        tableId: 1,
        tableStakes: '1/2',
        bigBlind: 2,
        handId: 'hand-1',
      })
      .expect(200);

    expect(response.body.playerId).toBe('p1-uuid-0001');
    expect(response.body.basePoints).toBe(5);
    expect(response.body.earnedPoints).toBe(5);
    expect(response.body.monthlyPoints).toBe(5);
    expect(response.body.currentTier).toBe('Bronze');
  });

  it('requires admin auth', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/points/award')
      .send({
        playerId: 'p1-uuid-0001',
        bigBlind: 2,
      })
      .expect(401);
  });
});
