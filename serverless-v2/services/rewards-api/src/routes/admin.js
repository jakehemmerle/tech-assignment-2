'use strict';

const { Router } = require('express');
const db = require('../services/dynamo.service');
const pointsService = require('../services/points.service');
const { getTierForPoints, getNextTier, getTierByLevel, getCurrentMonthKey } = require('../config/constants');

const router = Router();

router.get('/players/:playerId/rewards', async (req, res) => {
  try {
    const player = await db.getPlayer(req.params.playerId);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const tier = getTierForPoints(player.monthlyPoints);
    const nextTier = getNextTier(tier);
    const { items: recentTx } = await db.getTransactions(player.playerId, 20);
    const notifications = await db.getNotifications(player.playerId);

    res.json({
      playerId: player.playerId,
      displayName: player.displayName,
      currentTier: tier.name,
      tierLevel: tier.level,
      multiplier: tier.multiplier,
      monthlyPoints: player.monthlyPoints,
      lifetimePoints: player.lifetimePoints,
      tierFloor: player.tierFloor,
      highestTierThisMonth: player.highestTierThisMonth,
      monthKey: player.monthKey,
      nextTierTarget: nextTier ? nextTier.minPoints : null,
      pointsToNextTier: nextTier ? Math.max(0, nextTier.minPoints - player.monthlyPoints) : 0,
      createdAt: player.createdAt,
      updatedAt: player.updatedAt,
      recentTransactions: recentTx,
      notifications,
    });
  } catch (err) {
    console.error('Admin player rewards error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
});

router.post('/points/adjust', async (req, res) => {
  try {
    const { playerId, points, reason } = req.body;

    if (!playerId || points == null || !reason) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'playerId, points, and reason are required',
      });
    }

    const result = await pointsService.adjustPoints({
      playerId,
      points: parseInt(points),
      reason,
      adminId: req.headers['x-admin-id'] || 'admin',
    });

    res.json(result);
  } catch (err) {
    console.error('Admin adjust points error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const monthKey = getCurrentMonthKey();
    const entries = await db.getLeaderboard(monthKey);
    entries.sort((a, b) => b.monthlyPoints - a.monthlyPoints);

    const ranked = entries.map((e, i) => ({
      rank: i + 1,
      playerId: e.playerId,
      displayName: e.displayName,
      tier: getTierByLevel(e.tier).name,
      tierLevel: e.tier,
      monthlyPoints: e.monthlyPoints,
    }));

    res.json({ monthKey, leaderboard: ranked });
  } catch (err) {
    console.error('Admin leaderboard error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
});

router.post('/tier/override', async (req, res) => {
  try {
    const { playerId, tierLevel, expiresAt, reason } = req.body;

    if (!playerId || tierLevel == null) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'playerId and tierLevel are required',
      });
    }

    const tier = getTierByLevel(tierLevel);
    await db.updatePlayer(playerId, {
      currentTier: tier.level,
      overrideTier: tier.level,
      overrideExpiresAt: expiresAt || null,
      overrideReason: reason || 'Admin override',
      updatedAt: new Date().toISOString(),
    });

    res.json({
      playerId,
      overrideTier: tier.name,
      overrideTierLevel: tier.level,
      expiresAt: expiresAt || null,
    });
  } catch (err) {
    console.error('Admin tier override error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
});

module.exports = router;
