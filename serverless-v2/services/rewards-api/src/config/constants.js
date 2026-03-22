'use strict';

const TIERS = [
  { level: 1, name: 'Bronze', minPoints: 0, multiplier: 1.0 },
  { level: 2, name: 'Silver', minPoints: 500, multiplier: 1.25 },
  { level: 3, name: 'Gold', minPoints: 2000, multiplier: 1.5 },
  { level: 4, name: 'Platinum', minPoints: 10000, multiplier: 2.0 },
];

const STAKES_POINTS = [
  { minBB: 10.0, basePoints: 10 },
  { minBB: 2.0, basePoints: 5 },
  { minBB: 0.5, basePoints: 2 },
  { minBB: 0.1, basePoints: 1 },
];

const MILESTONES = [500, 1000, 2500, 5000, 10000];

function getBasePoints(bigBlind) {
  for (const rule of STAKES_POINTS) {
    if (bigBlind >= rule.minBB) return rule.basePoints;
  }
  return 1;
}

function getTierForPoints(monthlyPoints) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (monthlyPoints >= TIERS[i].minPoints) return TIERS[i];
  }
  return TIERS[0];
}

function getNextTier(currentTier) {
  const idx = TIERS.findIndex((t) => t.name === currentTier.name);
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

function getTierByLevel(level) {
  return TIERS.find((t) => t.level === level) || TIERS[0];
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

module.exports = {
  TIERS,
  STAKES_POINTS,
  MILESTONES,
  getBasePoints,
  getTierForPoints,
  getNextTier,
  getTierByLevel,
  getCurrentMonthKey,
};
