'use strict';

const { Router } = require('express');
const pointsService = require('../services/points.service');

const router = Router();

router.post('/award', async (req, res) => {
  try {
    const { playerId, tableId, tableStakes, bigBlind, handId } = req.body;

    if (!playerId || bigBlind == null) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'playerId and bigBlind are required',
      });
    }

    const result = await pointsService.awardPoints({
      playerId,
      tableId: tableId || null,
      tableStakes: tableStakes || '',
      bigBlind: parseFloat(bigBlind),
      handId: handId || null,
    });

    res.json(result);
  } catch (err) {
    console.error('Award points error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
});

module.exports = router;
