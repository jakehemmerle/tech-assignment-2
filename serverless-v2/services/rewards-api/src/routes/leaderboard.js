'use strict';

const { Router } = require('express');
const db = require('../services/dynamo.service');
const { getCurrentMonthKey, getTierByLevel } = require('../config/constants');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const monthKey = getCurrentMonthKey();
    const entries = await db.getLeaderboard(monthKey);

    // Sort by monthly points descending
    entries.sort((a, b) => b.monthlyPoints - a.monthlyPoints);

    const ranked = entries.map((e, i) => ({
      rank: i + 1,
      playerId: e.playerId,
      displayName: e.displayName,
      tier: getTierByLevel(e.tier).name,
      monthlyPoints: e.monthlyPoints,
    }));

    const top = ranked.slice(0, limit);

    // Find requesting player's rank
    let playerRank = null;
    if (req.playerId) {
      const found = ranked.find((r) => r.playerId === req.playerId);
      if (found) {
        playerRank = found;
      }
    }

    res.json({
      monthKey,
      leaderboard: top,
      playerRank,
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
});

module.exports = router;
