'use strict';

const {
  getBasePoints,
  getTierForPoints,
  getNextTier,
  getTierByLevel,
  getCurrentMonthKey,
  TIERS,
  MILESTONES,
} = require('../src/config/constants');

describe('Constants — Tier Logic', () => {
  it('should return Bronze for 0 points', () => {
    const tier = getTierForPoints(0);
    expect(tier.name).toBe('Bronze');
    expect(tier.multiplier).toBe(1.0);
  });

  it('should return Silver for 500 points', () => {
    const tier = getTierForPoints(500);
    expect(tier.name).toBe('Silver');
    expect(tier.multiplier).toBe(1.25);
  });

  it('should return Gold for 2000 points', () => {
    const tier = getTierForPoints(2000);
    expect(tier.name).toBe('Gold');
    expect(tier.multiplier).toBe(1.5);
  });

  it('should return Platinum for 10000 points', () => {
    const tier = getTierForPoints(10000);
    expect(tier.name).toBe('Platinum');
    expect(tier.multiplier).toBe(2.0);
  });

  it('should return correct tier at boundary values', () => {
    expect(getTierForPoints(499).name).toBe('Bronze');
    expect(getTierForPoints(500).name).toBe('Silver');
    expect(getTierForPoints(1999).name).toBe('Silver');
    expect(getTierForPoints(2000).name).toBe('Gold');
    expect(getTierForPoints(9999).name).toBe('Gold');
    expect(getTierForPoints(10000).name).toBe('Platinum');
  });

  it('should return next tier correctly', () => {
    const bronze = getTierForPoints(0);
    const nextAfterBronze = getNextTier(bronze);
    expect(nextAfterBronze.name).toBe('Silver');

    const platinum = getTierForPoints(10000);
    const nextAfterPlatinum = getNextTier(platinum);
    expect(nextAfterPlatinum).toBeNull();
  });

  it('should look up tier by level', () => {
    expect(getTierByLevel(1).name).toBe('Bronze');
    expect(getTierByLevel(2).name).toBe('Silver');
    expect(getTierByLevel(3).name).toBe('Gold');
    expect(getTierByLevel(4).name).toBe('Platinum');
  });
});

describe('Constants — Points Calculation', () => {
  it('should return 1 base point for BB $0.10-$0.25', () => {
    expect(getBasePoints(0.10)).toBe(1);
    expect(getBasePoints(0.25)).toBe(1);
  });

  it('should return 2 base points for BB $0.50-$1.00', () => {
    expect(getBasePoints(0.50)).toBe(2);
    expect(getBasePoints(1.00)).toBe(2);
  });

  it('should return 5 base points for BB $2.00-$5.00', () => {
    expect(getBasePoints(2.00)).toBe(5);
    expect(getBasePoints(5.00)).toBe(5);
  });

  it('should return 10 base points for BB $10.00+', () => {
    expect(getBasePoints(10.00)).toBe(10);
    expect(getBasePoints(25.00)).toBe(10);
    expect(getBasePoints(100.00)).toBe(10);
  });

  it('should calculate earned points with multiplier', () => {
    // Bronze (1.0x) at $2/$5 table = 5 * 1.0 = 5
    const base = getBasePoints(5);
    const bronze = getTierForPoints(0);
    expect(Math.round(base * bronze.multiplier)).toBe(5);

    // Gold (1.5x) at $2/$5 table = 5 * 1.5 = 8 (rounded)
    const gold = getTierForPoints(2000);
    expect(Math.round(base * gold.multiplier)).toBe(8);

    // Platinum (2.0x) at $5/$10 table = 10 * 2.0 = 20
    const base10 = getBasePoints(10);
    const plat = getTierForPoints(10000);
    expect(Math.round(base10 * plat.multiplier)).toBe(20);
  });
});

describe('Constants — Month Key', () => {
  it('should return YYYY-MM format', () => {
    const key = getCurrentMonthKey();
    expect(key).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe('Constants — Milestones', () => {
  it('should have expected milestones', () => {
    expect(MILESTONES).toEqual([500, 1000, 2500, 5000, 10000]);
  });
});
