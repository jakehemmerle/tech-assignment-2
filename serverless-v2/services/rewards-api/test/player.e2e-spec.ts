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

function getMonthFixtureDate(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 5));
}

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

  it('derives the last six months of tier progression from rewards history', async () => {
    const twoMonthsAgo = getMonthKeyWithOffset(-2);
    const currentMonth = getMonthKeyWithOffset(0);

    await putRewardsTestItem(rewardsTestTables.players, {
      playerId: 'p5-uuid-0005',
      displayName: 'Echo',
      currentTier: 1,
      monthlyPoints: 0,
      lifetimePoints: 2000,
      tierFloor: 1,
      highestTierThisMonth: 1,
      monthKey: currentMonth,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await putRewardsTestItem(rewardsTestTables.transactions, {
      playerId: 'p5-uuid-0005',
      timestamp: getMonthFixtureDate(twoMonthsAgo).getTime(),
      type: 'adjustment',
      basePoints: 2000,
      multiplier: 1,
      earnedPoints: 2000,
      monthKey: twoMonthsAgo,
      reason: 'timeline fixture',
      adminId: 'admin-1',
      createdAt: getMonthFixtureDate(twoMonthsAgo).toISOString(),
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/player/rewards/timeline')
      .set('X-Player-Id', 'p5-uuid-0005')
      .expect(200);

    expect(response.body.months).toHaveLength(6);

    const goldMonth = response.body.months.find(
      (month: { monthKey: string }) => month.monthKey === twoMonthsAgo
    );
    expect(goldMonth).toMatchObject({
      monthKey: twoMonthsAgo,
      tier: 'Gold',
      tierLevel: 3,
      monthlyPoints: 2000,
      isCurrentMonth: false,
    });

    const previousMonth = response.body.months.find(
      (month: { monthKey: string }) => month.monthKey === getMonthKeyWithOffset(-1)
    );
    expect(previousMonth).toMatchObject({
      tier: 'Silver',
      tierLevel: 2,
      monthlyPoints: 0,
      isCurrentMonth: false,
    });

    const activeMonth = response.body.months.find(
      (month: { monthKey: string }) => month.monthKey === currentMonth
    );
    expect(activeMonth).toMatchObject({
      monthKey: currentMonth,
      tier: 'Bronze',
      tierLevel: 1,
      monthlyPoints: 0,
      isCurrentMonth: true,
    });
  });
});
