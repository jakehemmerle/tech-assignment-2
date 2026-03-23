import request from 'supertest';
import { INestApplication } from '@nestjs/common';

import {
  createTestingApp,
  ensureRewardsTables,
  putRewardsTestItem,
  resetRewardsTables,
  rewardsTestTables,
} from './setup-e2e';

function getCurrentMonthKey() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

describe('admin endpoints e2e', () => {
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

  it('requires admin auth on admin surfaces', async () => {
    const server = request(app.getHttpServer());

    await server.get('/admin/players/p1-uuid-0001/rewards').expect(401);
    await server.get('/admin/leaderboard').expect(401);
    await server
      .post('/admin/tier/override')
      .send({ playerId: 'p1-uuid-0001', tierLevel: 4 })
      .expect(401);
    await server.post('/admin/monthly-reset').send({}).expect(401);
  });

  it('returns the full admin profile with email, transactions, and notifications', async () => {
    const monthKey = getCurrentMonthKey();
    const createdAt = new Date().toISOString();

    await putRewardsTestItem(rewardsTestTables.players, {
      playerId: 'p1-uuid-0001',
      displayName: 'Alice',
      currentTier: 2,
      monthlyPoints: 525,
      lifetimePoints: 525,
      tierFloor: 1,
      highestTierThisMonth: 2,
      monthKey,
      createdAt,
      updatedAt: createdAt,
    });

    for (let index = 0; index < 21; index += 1) {
      await putRewardsTestItem(rewardsTestTables.transactions, {
        playerId: 'p1-uuid-0001',
        timestamp: 1_700_000_000_000 + index,
        type: 'gameplay',
        basePoints: 5,
        multiplier: 1,
        earnedPoints: 5,
        tableId: 1,
        tableStakes: '1/2',
        bigBlind: 2,
        handId: `hand-${index}`,
        monthKey,
        reason: 'Hand played',
        adminId: 'admin-1',
        createdAt,
      });
    }

    await putRewardsTestItem(rewardsTestTables.notifications, {
      playerId: 'p1-uuid-0001',
      notificationId: 'notification-1',
      type: 'milestone',
      title: 'Milestone: 500 Points',
      description: "You've earned 500 lifetime points!",
      dismissed: false,
      createdAt,
    });

    const response = await request(app.getHttpServer())
      .get('/admin/players/p1-uuid-0001/rewards')
      .set('X-Admin-Id', 'admin-1')
      .expect(200);

    expect(response.body.email).toBe('alice@example.com');
    expect(response.body.transactions).toHaveLength(21);
    expect(response.body.recentTransactions).toHaveLength(20);
    expect(response.body.notifications).toHaveLength(1);
    expect(response.body.transactions[0].timestamp).toBeGreaterThan(
      response.body.transactions[20].timestamp
    );
  });

  it('stores override metadata and updates the leaderboard tier immediately', async () => {
    const monthKey = getCurrentMonthKey();
    const createdAt = new Date().toISOString();

    await putRewardsTestItem(rewardsTestTables.players, {
      playerId: 'p4-uuid-0004',
      displayName: 'Diana',
      currentTier: 2,
      monthlyPoints: 600,
      lifetimePoints: 600,
      tierFloor: 1,
      highestTierThisMonth: 2,
      monthKey,
      createdAt,
      updatedAt: createdAt,
    });

    await putRewardsTestItem(rewardsTestTables.leaderboard, {
      monthKey,
      playerId: 'p4-uuid-0004',
      tier: 2,
      monthlyPoints: 600,
    });

    await request(app.getHttpServer())
      .post('/admin/tier/override')
      .set('X-Admin-Id', 'admin-1')
      .send({
        playerId: 'p4-uuid-0004',
        tierLevel: 4,
        expiresAt: '2026-04-01T00:00:00.000Z',
        reason: 'VIP comp',
      })
      .expect(200);

    const profileResponse = await request(app.getHttpServer())
      .get('/admin/players/p4-uuid-0004/rewards')
      .set('X-Admin-Id', 'admin-1')
      .expect(200);

    expect(profileResponse.body.currentTier).toBe('Platinum');
    expect(profileResponse.body.overrideTier).toBe(4);
    expect(profileResponse.body.overrideExpiresAt).toBe('2026-04-01T00:00:00.000Z');
    expect(profileResponse.body.overrideReason).toBe('VIP comp');

    const leaderboardResponse = await request(app.getHttpServer())
      .get('/admin/leaderboard')
      .set('X-Admin-Id', 'admin-1')
      .expect(200);

    expect(leaderboardResponse.body.leaderboard).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          playerId: 'p4-uuid-0004',
          tier: 'Platinum',
          tierLevel: 4,
          email: 'diana@example.com',
        }),
      ])
    );
  });
});
