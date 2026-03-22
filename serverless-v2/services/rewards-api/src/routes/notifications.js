'use strict';

const { Router } = require('express');
const notifService = require('../services/notifications.service');

const router = Router();

router.get('/', async (req, res) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const items = await notifService.getPlayerNotifications(req.playerId, unreadOnly);

    res.json({
      notifications: items.map((n) => ({
        notificationId: n.notificationId,
        type: n.type,
        title: n.title,
        description: n.description,
        dismissed: n.dismissed,
        createdAt: n.createdAt,
        dismissedAt: n.dismissedAt || null,
      })),
      total: items.length,
    });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
});

router.patch('/:id/dismiss', async (req, res) => {
  try {
    await notifService.dismiss(req.playerId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Dismiss error:', err);
    res.status(500).json({ error: 'Internal error', message: err.message });
  }
});

module.exports = router;
