'use strict';

const { PutCommand, GetCommand, QueryCommand, UpdateCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../../shared/config/dynamo');

const PLAYERS_TABLE = process.env.REWARDS_PLAYERS_TABLE || 'rewards-players';
const TRANSACTIONS_TABLE = process.env.REWARDS_TRANSACTIONS_TABLE || 'rewards-transactions';
const LEADERBOARD_TABLE = process.env.REWARDS_LEADERBOARD_TABLE || 'rewards-leaderboard';
const NOTIFICATIONS_TABLE = process.env.REWARDS_NOTIFICATIONS_TABLE || 'rewards-notifications';

// --- Players ---

async function getPlayer(playerId) {
  const result = await docClient.send(
    new GetCommand({ TableName: PLAYERS_TABLE, Key: { playerId } })
  );
  return result.Item || null;
}

async function putPlayer(player) {
  await docClient.send(new PutCommand({ TableName: PLAYERS_TABLE, Item: player }));
}

async function updatePlayer(playerId, updates) {
  const expressions = [];
  const names = {};
  const values = {};
  Object.entries(updates).forEach(([key, value], i) => {
    expressions.push(`#k${i} = :v${i}`);
    names[`#k${i}`] = key;
    values[`:v${i}`] = value;
  });
  await docClient.send(
    new UpdateCommand({
      TableName: PLAYERS_TABLE,
      Key: { playerId },
      UpdateExpression: `SET ${expressions.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
}

async function getAllPlayers() {
  const result = await docClient.send(new ScanCommand({ TableName: PLAYERS_TABLE }));
  return result.Items || [];
}

// --- Transactions ---

async function addTransaction(playerId, transaction) {
  await docClient.send(
    new PutCommand({
      TableName: TRANSACTIONS_TABLE,
      Item: { playerId, timestamp: Date.now(), ...transaction },
    })
  );
}

async function getTransactions(playerId, limit = 20, exclusiveStartKey = null) {
  const params = {
    TableName: TRANSACTIONS_TABLE,
    KeyConditionExpression: 'playerId = :pid',
    ExpressionAttributeValues: { ':pid': playerId },
    ScanIndexForward: false,
    Limit: limit,
  };
  if (exclusiveStartKey) params.ExclusiveStartKey = exclusiveStartKey;
  const result = await docClient.send(new QueryCommand(params));
  return { items: result.Items || [], lastKey: result.LastEvaluatedKey || null };
}

// --- Leaderboard ---

async function putLeaderboardEntry(monthKey, entry) {
  await docClient.send(
    new PutCommand({
      TableName: LEADERBOARD_TABLE,
      Item: { monthKey, ...entry },
    })
  );
}

async function getLeaderboard(monthKey) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: LEADERBOARD_TABLE,
      KeyConditionExpression: 'monthKey = :mk',
      ExpressionAttributeValues: { ':mk': monthKey },
    })
  );
  return result.Items || [];
}

// --- Notifications ---

async function addNotification(notification) {
  await docClient.send(
    new PutCommand({ TableName: NOTIFICATIONS_TABLE, Item: notification })
  );
}

async function getNotifications(playerId, unreadOnly = false) {
  const params = {
    TableName: NOTIFICATIONS_TABLE,
    KeyConditionExpression: 'playerId = :pid',
    ExpressionAttributeValues: { ':pid': playerId },
    ScanIndexForward: false,
  };
  if (unreadOnly) {
    params.FilterExpression = 'dismissed = :f';
    params.ExpressionAttributeValues[':f'] = false;
  }
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

async function dismissNotification(playerId, notificationId) {
  await docClient.send(
    new UpdateCommand({
      TableName: NOTIFICATIONS_TABLE,
      Key: { playerId, notificationId },
      UpdateExpression: 'SET dismissed = :t, dismissedAt = :at',
      ExpressionAttributeValues: { ':t': true, ':at': new Date().toISOString() },
    })
  );
}

module.exports = {
  getPlayer,
  putPlayer,
  updatePlayer,
  getAllPlayers,
  addTransaction,
  getTransactions,
  putLeaderboardEntry,
  getLeaderboard,
  addNotification,
  getNotifications,
  dismissNotification,
};
