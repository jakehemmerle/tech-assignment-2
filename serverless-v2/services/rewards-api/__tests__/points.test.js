'use strict';

// Mock dynamo service
const mockDb = {
  players: {},
  transactions: {},
  leaderboard: {},
  notifications: [],
};

jest.mock('../src/services/dynamo.service', () => ({
  getPlayer: jest.fn(async (id) => mockDb.players[id] || null),
  putPlayer: jest.fn(async (player) => { mockDb.players[player.playerId] = player; }),
  updatePlayer: jest.fn(async (id, updates) => {
    if (!mockDb.players[id]) mockDb.players[id] = { playerId: id };
    Object.assign(mockDb.players[id], updates);
  }),
  addTransaction: jest.fn(async (id, tx) => {
    if (!mockDb.transactions[id]) mockDb.transactions[id] = [];
    mockDb.transactions[id].push({ playerId: id, timestamp: Date.now(), ...tx });
  }),
  getTransactions: jest.fn(async (id, limit) => ({
    items: (mockDb.transactions[id] || []).slice(0, limit),
    lastKey: null,
  })),
  putLeaderboardEntry: jest.fn(async (mk, entry) => {
    mockDb.leaderboard[`${mk}:${entry.playerId}`] = entry;
  }),
  getLeaderboard: jest.fn(async () => Object.values(mockDb.leaderboard)),
  addNotification: jest.fn(async (n) => { mockDb.notifications.push(n); }),
  getNotifications: jest.fn(async () => []),
  dismissNotification: jest.fn(async () => {}),
  getAllPlayers: jest.fn(async () => Object.values(mockDb.players)),
}));

const pointsService = require('../src/services/points.service');
const { getTierForPoints, getCurrentMonthKey } = require('../src/config/constants');

beforeEach(() => {
  mockDb.players = {};
  mockDb.transactions = {};
  mockDb.leaderboard = {};
  mockDb.notifications = [];
  jest.clearAllMocks();
});

describe('Points Service — Award Points', () => {
  it('should create player on first award', async () => {
    const result = await pointsService.awardPoints({
      playerId: 'test-1',
      tableId: 1,
      tableStakes: '1/2',
      bigBlind: 2,
      handId: 'hand-1',
    });

    expect(result.playerId).toBe('test-1');
    expect(result.basePoints).toBe(5); // BB $2 = 5 base
    expect(result.multiplier).toBe(1.0); // Bronze
    expect(result.earnedPoints).toBe(5);
    expect(result.monthlyPoints).toBe(5);
    expect(result.currentTier).toBe('Bronze');
  });

  it('should accumulate points correctly', async () => {
    // First award
    await pointsService.awardPoints({
      playerId: 'test-2',
      tableId: 1,
      tableStakes: '5/10',
      bigBlind: 10,
      handId: 'hand-1',
    });

    // Second award
    const result = await pointsService.awardPoints({
      playerId: 'test-2',
      tableId: 1,
      tableStakes: '5/10',
      bigBlind: 10,
      handId: 'hand-2',
    });

    expect(result.monthlyPoints).toBe(20); // 10 + 10
    expect(result.lifetimePoints).toBe(20);
  });

  it('should apply tier multiplier', async () => {
    // Set up a Silver tier player
    mockDb.players['test-3'] = {
      playerId: 'test-3',
      currentTier: 2,
      monthlyPoints: 600,
      lifetimePoints: 600,
      tierFloor: 1,
      highestTierThisMonth: 2,
      monthKey: getCurrentMonthKey(),
      displayName: 'test-3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await pointsService.awardPoints({
      playerId: 'test-3',
      tableId: 1,
      tableStakes: '1/2',
      bigBlind: 2,
      handId: 'hand-1',
    });

    // Silver = 1.25x, base 5 = 6 (rounded)
    expect(result.basePoints).toBe(5);
    expect(result.multiplier).toBe(1.25);
    expect(result.earnedPoints).toBe(6);
  });

  it('should trigger tier upgrade', async () => {
    // Set up a player near Silver threshold
    mockDb.players['test-4'] = {
      playerId: 'test-4',
      currentTier: 1,
      monthlyPoints: 496,
      lifetimePoints: 496,
      tierFloor: 1,
      highestTierThisMonth: 1,
      monthKey: getCurrentMonthKey(),
      displayName: 'test-4',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await pointsService.awardPoints({
      playerId: 'test-4',
      tableId: 1,
      tableStakes: '1/2',
      bigBlind: 2,
      handId: 'hand-1',
    });

    // 496 + 5 = 501 => Silver
    expect(result.currentTier).toBe('Silver');

    // Should have created a tier upgrade notification
    const db = require('../src/services/dynamo.service');
    expect(db.addNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 'test-4',
        type: 'tier_upgrade',
      })
    );
  });

  it('should handle different stake levels correctly', async () => {
    const testCases = [
      { bigBlind: 0.10, expectedBase: 1 },
      { bigBlind: 0.25, expectedBase: 1 },
      { bigBlind: 0.50, expectedBase: 2 },
      { bigBlind: 1.00, expectedBase: 2 },
      { bigBlind: 2.00, expectedBase: 5 },
      { bigBlind: 5.00, expectedBase: 5 },
      { bigBlind: 10.00, expectedBase: 10 },
      { bigBlind: 25.00, expectedBase: 10 },
    ];

    for (const { bigBlind, expectedBase } of testCases) {
      mockDb.players = {};
      const result = await pointsService.awardPoints({
        playerId: `stake-test`,
        tableId: 1,
        tableStakes: `test`,
        bigBlind,
        handId: `hand-${bigBlind}`,
      });
      expect(result.basePoints).toBe(expectedBase);
    }
  });
});

describe('Points Service — Adjust Points', () => {
  it('should adjust points positively', async () => {
    mockDb.players['adj-1'] = {
      playerId: 'adj-1',
      currentTier: 1,
      monthlyPoints: 100,
      lifetimePoints: 100,
      tierFloor: 1,
      highestTierThisMonth: 1,
      monthKey: getCurrentMonthKey(),
      displayName: 'adj-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await pointsService.adjustPoints({
      playerId: 'adj-1',
      points: 50,
      reason: 'Bonus',
      adminId: 'admin-1',
    });

    expect(result.monthlyPoints).toBe(150);
    expect(result.lifetimePoints).toBe(150);
  });

  it('should adjust points negatively without going below zero', async () => {
    mockDb.players['adj-2'] = {
      playerId: 'adj-2',
      currentTier: 1,
      monthlyPoints: 30,
      lifetimePoints: 30,
      tierFloor: 1,
      highestTierThisMonth: 1,
      monthKey: getCurrentMonthKey(),
      displayName: 'adj-2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await pointsService.adjustPoints({
      playerId: 'adj-2',
      points: -50,
      reason: 'Correction',
      adminId: 'admin-1',
    });

    expect(result.monthlyPoints).toBe(0);
  });
});

describe('Points Service — Monthly Reset', () => {
  it('should reset monthly points on new month', async () => {
    mockDb.players['reset-1'] = {
      playerId: 'reset-1',
      currentTier: 3, // Gold
      monthlyPoints: 3000,
      lifetimePoints: 5000,
      tierFloor: 2,
      highestTierThisMonth: 3,
      monthKey: '2025-01', // Old month
      displayName: 'reset-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await pointsService.awardPoints({
      playerId: 'reset-1',
      tableId: 1,
      tableStakes: '1/2',
      bigBlind: 2,
      handId: 'hand-1',
    });

    // Gold floor = max(1, 3-1) = 2 (Silver)
    // After reset to Silver (level 2), multiplier = 1.25
    // 5 base * 1.25 = 6.25, rounds to 6
    expect(result.monthlyPoints).toBe(6);
    expect(result.multiplier).toBe(1.25);
  });
});
