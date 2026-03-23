import request from 'supertest';
import { INestApplication } from '@nestjs/common';

import {
  createTestingApp,
  ensureRewardsTables,
  putRewardsTestItem,
  resetRewardsTables,
  rewardsTestTables,
} from './setup-e2e';

function getMonthKeyWithOffset(offset: number) {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCMonth(date.getUTCMonth() + offset);

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

describe('monthly reset e2e', () => {
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

  it('applies floor protection and creates a downgrade notification', async () => {
    const previousMonthKey = getMonthKeyWithOffset(-1);
    const currentMonthKey = getMonthKeyWithOffset(0);
    const createdAt = new Date().toISOString();

    await putRewardsTestItem(rewardsTestTables.players, {
      playerId: 'p2-uuid-0002',
      displayName: 'Bob',
      currentTier: 4,
      monthlyPoints: 12000,
      lifetimePoints: 15000,
      tierFloor: 1,
      highestTierThisMonth: 4,
      monthKey: previousMonthKey,
      createdAt,
      updatedAt: createdAt,
    });

    await putRewardsTestItem(rewardsTestTables.leaderboard, {
      monthKey: previousMonthKey,
      playerId: 'p2-uuid-0002',
      tier: 4,
      monthlyPoints: 12000,
    });

    const resetResponse = await request(app.getHttpServer())
      .post('/admin/monthly-reset')
      .set('X-Admin-Id', 'admin-1')
      .send({ monthKey: currentMonthKey })
      .expect(200);

    expect(resetResponse.body).toEqual({
      monthKey: currentMonthKey,
      resetCount: 1,
    });

    const profileResponse = await request(app.getHttpServer())
      .get('/admin/players/p2-uuid-0002/rewards')
      .set('X-Admin-Id', 'admin-1')
      .expect(200);

    expect(profileResponse.body).toMatchObject({
      playerId: 'p2-uuid-0002',
      currentTier: 'Gold',
      tierLevel: 3,
      monthlyPoints: 0,
      tierFloor: 3,
      highestTierThisMonth: 3,
      monthKey: currentMonthKey,
      email: 'bob@example.com',
    });
    expect(profileResponse.body.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tier_downgrade',
          description: expect.stringContaining('Gold'),
        }),
      ])
    );

    const leaderboardResponse = await request(app.getHttpServer())
      .get('/admin/leaderboard')
      .set('X-Admin-Id', 'admin-1')
      .expect(200);

    expect(
      leaderboardResponse.body.leaderboard.find(
        (entry: { playerId: string }) => entry.playerId === 'p2-uuid-0002'
      )
    ).toBeUndefined();
  });
});
