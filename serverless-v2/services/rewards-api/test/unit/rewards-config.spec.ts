import {
  applyMultiplier,
  getBasePoints,
  getTierForPoints,
} from '../../src/config/rewards.config';

describe('rewards config', () => {
  it('maps big blind to base points', () => {
    expect(getBasePoints(0.1)).toBe(1);
    expect(getBasePoints(0.25)).toBe(1);
    expect(getBasePoints(0.5)).toBe(2);
    expect(getBasePoints(1)).toBe(2);
    expect(getBasePoints(2)).toBe(5);
    expect(getBasePoints(5)).toBe(5);
    expect(getBasePoints(10)).toBe(10);
  });

  it('rounds multiplier math to whole numbers', () => {
    expect(applyMultiplier(5, 1.25)).toBe(6);
    expect(applyMultiplier(5, 1.5)).toBe(8);
    expect(applyMultiplier(10, 2)).toBe(20);
  });

  it('maps monthly points to tiers', () => {
    expect(getTierForPoints(0).name).toBe('Bronze');
    expect(getTierForPoints(500).name).toBe('Silver');
    expect(getTierForPoints(2000).name).toBe('Gold');
    expect(getTierForPoints(10000).name).toBe('Platinum');
  });
});
