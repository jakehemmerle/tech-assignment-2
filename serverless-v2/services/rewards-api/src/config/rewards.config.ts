import { TierConfig } from './rewards.types';

export const TIERS: TierConfig[] = [
  { level: 1, name: 'Bronze', minPoints: 0, multiplier: 1.0 },
  { level: 2, name: 'Silver', minPoints: 500, multiplier: 1.25 },
  { level: 3, name: 'Gold', minPoints: 2000, multiplier: 1.5 },
  { level: 4, name: 'Platinum', minPoints: 10000, multiplier: 2.0 },
];

export const STAKES_POINTS = [
  { minBB: 10.0, basePoints: 10 },
  { minBB: 2.0, basePoints: 5 },
  { minBB: 0.5, basePoints: 2 },
  { minBB: 0.1, basePoints: 1 },
];

export const MILESTONES = [500, 1000, 2000, 10000];

export const REWARDS_TABLES = {
  players: process.env.REWARDS_PLAYERS_TABLE ?? 'rewards-players',
  transactions: process.env.REWARDS_TRANSACTIONS_TABLE ?? 'rewards-transactions',
  leaderboard: process.env.REWARDS_LEADERBOARD_TABLE ?? 'rewards-leaderboard',
  notifications: process.env.REWARDS_NOTIFICATIONS_TABLE ?? 'rewards-notifications',
};

export function getCurrentMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getBasePoints(bigBlind: number) {
  for (const rule of STAKES_POINTS) {
    if (bigBlind >= rule.minBB) {
      return rule.basePoints;
    }
  }

  return 1;
}

export function applyMultiplier(basePoints: number, multiplier: number) {
  return Math.round(basePoints * multiplier);
}

export function getTierByLevel(level: number) {
  return TIERS.find((tier) => tier.level === level) ?? TIERS[0];
}

export function getTierForPoints(monthlyPoints: number) {
  for (let index = TIERS.length - 1; index >= 0; index -= 1) {
    if (monthlyPoints >= TIERS[index].minPoints) {
      return TIERS[index];
    }
  }

  return TIERS[0];
}

export function getNextTier(level: number) {
  const currentIndex = TIERS.findIndex((tier) => tier.level === level);
  if (currentIndex < 0 || currentIndex === TIERS.length - 1) {
    return null;
  }

  return TIERS[currentIndex + 1];
}

export function getFloorTier(highestTier: number) {
  return Math.max(1, highestTier - 1);
}
