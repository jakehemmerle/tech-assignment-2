'use strict';

const { Router } = require('express');
const { ensurePlayer } = require('../services/points.service');
const db = require('../services/dynamo.service');
const { getTierForPoints, getNextTier, getCurrentMonthKey, TIERS } = require('../config/constants');
const { getUnreadCount } = require('../services/notifications.service');

const router = Router();

router.get('/rewards', async (req, res) => {
  try {
    const player = await ensurePlayer(req.playerId);
    const currentMonthKey = getCurrentMonthKey();
    const tier = getTierForPoints(player.monthlyPoints);
    const nextTier = getNextTier(tier);
    const unreadCount = await getUnreadCount(req.playerId);

    const { items: recentTx } = await db.getTransactions(req.playerId, 5);

    res.json({
      playerId: player.playerId,
      displayName: player.displayName,
      currentTier: tier.name,
      tierLevel: tier.level,
      multiplier: tier.multiplier,
      monthlyPoints: player.monthlyPoints,
      lifetimePoints: player.lifetimePoints,
      nextTierTarget: nextTier ? nextTier.minPoints : null,
      pointsToNextTier: nextTier ? Math.max(0, nextTier.minPoints - player.monthlyPoints) : 0,
      unreadNotifications: unreadCount,
      recentTimeline: recentTx.map((tx) => ({
        timestamp: tx.timestamp,
        type: tx.type,
        earnedPoints: tx.earnedPoints,
        reason: tx.reason,
      })),
    });
  } catch (err) {
    console.error('Get rewards error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
});

router.get('/rewards/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    // DynamoDB doesn't support offset natively, so we fetch limit+offset and skip
    const fetchLimit = limit + offset;
    const { items } = await db.getTransactions(req.playerId, fetchLimit);
    const sliced = items.slice(offset, offset + limit);

    res.json({
      transactions: sliced.map((tx) => ({
        timestamp: tx.timestamp,
        type: tx.type,
        tableId: tx.tableId,
        tableStakes: tx.tableStakes,
        basePoints: tx.basePoints,
        multiplier: tx.multiplier,
        earnedPoints: tx.earnedPoints,
        reason: tx.reason,
        createdAt: tx.createdAt,
      })),
      total: items.length,
      limit,
      offset,
    });
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
});

module.exports = router;
