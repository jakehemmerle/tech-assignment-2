import request from 'supertest';
import { INestApplication } from '@nestjs/common';

import { createTestingApp, ensureRewardsTables, resetRewardsTables } from './setup-e2e';

describe('player endpoints e2e', () => {
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

  it('auto-creates a bronze player on summary read', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/player/rewards')
      .set('X-Player-Id', 'p3-uuid-0003')
      .expect(200);

    expect(response.body.playerId).toBe('p3-uuid-0003');
    expect(response.body.currentTier).toBe('Bronze');
    expect(response.body.monthlyPoints).toBe(0);
    expect(response.body.displayName).toBe('Charlie');
  });

  it('returns exact history totals with offset pagination', async () => {
    for (let index = 0; index < 3; index += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/points/award')
        .set('X-Admin-Id', 'admin-1')
        .send({
          playerId: 'p4-uuid-0004',
          bigBlind: 2,
          handId: `hand-${index}`,
        })
        .expect(200);
    }

    const response = await request(app.getHttpServer())
      .get('/api/v1/player/rewards/history?limit=2&offset=1')
      .set('X-Player-Id', 'p4-uuid-0004')
      .expect(200);

    expect(response.body.total).toBe(3);
    expect(response.body.transactions).toHaveLength(2);
    expect(response.body.offset).toBe(1);
  });
});
