'use strict';

const db = require('./dynamo.service');
const { getBasePoints, getTierForPoints, getNextTier, getTierByLevel, getCurrentMonthKey, MILESTONES } = require('../config/constants');
const notifications = require('./notifications.service');

async function ensurePlayer(playerId) {
  let player = await db.getPlayer(playerId);
  if (!player) {
    player = {
      playerId,
      currentTier: 1,
      monthlyPoints: 0,
      lifetimePoints: 0,
      tierFloor: 1,
      highestTierThisMonth: 1,
      monthKey: getCurrentMonthKey(),
      displayName: playerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.putPlayer(player);
  }
  return player;
}

async function awardPoints({ playerId, tableId, tableStakes, bigBlind, handId }) {
  let player = await ensurePlayer(playerId);
  const currentMonthKey = getCurrentMonthKey();

  // Check if monthly reset is needed
  if (player.monthKey !== currentMonthKey) {
    player = await performMonthlyReset(player, currentMonthKey);
  }

  // Use stored currentTier for multiplier (respects floor protection after reset)
  const activeTier = getTierByLevel(player.currentTier);
  const basePoints = getBasePoints(bigBlind);
  const earnedPoints = Math.round(basePoints * activeTier.multiplier);

  const transaction = {
    type: 'gameplay',
    basePoints,
    multiplier: activeTier.multiplier,
    earnedPoints,
    tableId,
    tableStakes,
    bigBlind,
    handId,
    monthKey: currentMonthKey,
    reason: 'Hand played',
    createdAt: new Date().toISOString(),
  };

  await db.addTransaction(playerId, transaction);

  const newMonthly = player.monthlyPoints + earnedPoints;
  const newLifetime = player.lifetimePoints + earnedPoints;
  const pointsTier = getTierForPoints(newMonthly);
  // Tier is the higher of: natural tier from points, or current tier (floor-protected)
  const newTier = pointsTier.level >= player.currentTier ? pointsTier : activeTier;
  const tierChanged = newTier.level > player.currentTier;
  const highestThisMonth = Math.max(player.highestTierThisMonth || 1, newTier.level);

  await db.updatePlayer(playerId, {
    monthlyPoints: newMonthly,
    lifetimePoints: newLifetime,
    currentTier: newTier.level,
    highestTierThisMonth: highestThisMonth,
    updatedAt: new Date().toISOString(),
  });

  // Update leaderboard
  await db.putLeaderboardEntry(currentMonthKey, {
    playerId,
    displayName: player.displayName,
    tier: newTier.level,
    monthlyPoints: newMonthly,
  });

  // Tier upgrade notification
  if (tierChanged) {
    await notifications.createTierUpgrade(playerId, newTier.name);
  }

  // Milestone notifications
  await notifications.checkMilestones(playerId, player.lifetimePoints, newLifetime);

  const nextTier = getNextTier(newTier);
  return {
    playerId,
    earnedPoints,
    basePoints,
    multiplier: activeTier.multiplier,
    monthlyPoints: newMonthly,
    lifetimePoints: newLifetime,
    currentTier: newTier.name,
    nextTierTarget: nextTier ? nextTier.minPoints : null,
    pointsToNextTier: nextTier ? nextTier.minPoints - newMonthly : 0,
    transaction,
  };
}

async function adjustPoints({ playerId, points, reason, adminId }) {
  let player = await ensurePlayer(playerId);
  const currentMonthKey = getCurrentMonthKey();

  if (player.monthKey !== currentMonthKey) {
    player = await performMonthlyReset(player, currentMonthKey);
  }

  const transaction = {
    type: 'adjustment',
    basePoints: Math.abs(points),
    multiplier: 1,
    earnedPoints: points,
    monthKey: currentMonthKey,
    reason: reason || 'Admin adjustment',
    adminId,
    createdAt: new Date().toISOString(),
  };

  await db.addTransaction(playerId, transaction);

  const newMonthly = Math.max(0, player.monthlyPoints + points);
  const newLifetime = player.lifetimePoints + points;
  const newTier = getTierForPoints(newMonthly);

  await db.updatePlayer(playerId, {
    monthlyPoints: newMonthly,
    lifetimePoints: newLifetime,
    currentTier: newTier.level,
    updatedAt: new Date().toISOString(),
  });

  await db.putLeaderboardEntry(currentMonthKey, {
    playerId,
    displayName: player.displayName,
    tier: newTier.level,
    monthlyPoints: newMonthly,
  });

  return {
    playerId,
    adjustedPoints: points,
    monthlyPoints: newMonthly,
    lifetimePoints: newLifetime,
    currentTier: newTier.name,
  };
}

async function performMonthlyReset(player, newMonthKey) {
  const highestTier = player.highestTierThisMonth || player.currentTier;
  const floor = Math.max(1, highestTier - 1);
  const newTierLevel = Math.max(floor, 1);

  const updates = {
    monthlyPoints: 0,
    monthKey: newMonthKey,
    currentTier: newTierLevel,
    tierFloor: floor,
    highestTierThisMonth: newTierLevel,
    updatedAt: new Date().toISOString(),
  };

  await db.updatePlayer(player.playerId, updates);

  if (newTierLevel < player.currentTier) {
    const { getTierByLevel } = require('../config/constants');
    const tier = getTierByLevel(newTierLevel);
    await notifications.createTierDowngrade(player.playerId, tier.name);
  }

  return { ...player, ...updates };
}

module.exports = { awardPoints, adjustPoints, ensurePlayer, performMonthlyReset };
