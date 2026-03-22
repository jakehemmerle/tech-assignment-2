'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('./dynamo.service');
const { MILESTONES } = require('../config/constants');

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function createTierUpgrade(playerId, tierName) {
  await db.addNotification({
    playerId,
    notificationId: makeId(),
    type: 'tier_upgrade',
    title: `Tier Upgrade: ${tierName}`,
    description: `Congratulations! You've reached ${tierName} tier!`,
    dismissed: false,
    createdAt: new Date().toISOString(),
  });
}

async function createTierDowngrade(playerId, tierName) {
  await db.addNotification({
    playerId,
    notificationId: makeId(),
    type: 'tier_downgrade',
    title: 'Tier Adjusted',
    description: `Your tier has been adjusted to ${tierName} for the new month.`,
    dismissed: false,
    createdAt: new Date().toISOString(),
  });
}

async function checkMilestones(playerId, oldLifetime, newLifetime) {
  for (const milestone of MILESTONES) {
    if (oldLifetime < milestone && newLifetime >= milestone) {
      await db.addNotification({
        playerId,
        notificationId: makeId(),
        type: 'milestone',
        title: `Milestone: ${milestone.toLocaleString()} Points`,
        description: `You've earned ${milestone.toLocaleString()} lifetime points!`,
        dismissed: false,
        createdAt: new Date().toISOString(),
      });
    }
  }
}

async function getPlayerNotifications(playerId, unreadOnly = false) {
  return db.getNotifications(playerId, unreadOnly);
}

async function dismiss(playerId, notificationId) {
  return db.dismissNotification(playerId, notificationId);
}

async function getUnreadCount(playerId) {
  const unread = await db.getNotifications(playerId, true);
  return unread.length;
}

module.exports = {
  createTierUpgrade,
  createTierDowngrade,
  checkMilestones,
  getPlayerNotifications,
  dismiss,
  getUnreadCount,
};
