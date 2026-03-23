#!/usr/bin/env node

'use strict';

const path = require('path');

function requireDependency(moduleName) {
  const fallbackPath = path.join(
    __dirname,
    '..',
    'serverless-v2',
    'services',
    'rewards-api',
    'node_modules',
    moduleName
  );

  try {
    return require(moduleName);
  } catch (rootError) {
    try {
      return require(fallbackPath);
    } catch (fallbackError) {
      throw new Error(
        `Missing dependency "${moduleName}". Run "npm install" in serverless-v2/services/rewards-api first.`
      );
    }
  }
}

const mysql = requireDependency('mysql2/promise');
const { DynamoDBClient } = requireDependency('@aws-sdk/client-dynamodb');
const {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} = requireDependency('@aws-sdk/lib-dynamodb');

const DRY_RUN = process.argv.includes('--dry-run');

const ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
const REGION = process.env.AWS_REGION || 'us-east-1';
const TABLES = {
  players: process.env.REWARDS_PLAYERS_TABLE || 'rewards-players',
  transactions: process.env.REWARDS_TRANSACTIONS_TABLE || 'rewards-transactions',
  leaderboard: process.env.REWARDS_LEADERBOARD_TABLE || 'rewards-leaderboard',
  notifications: process.env.REWARDS_NOTIFICATIONS_TABLE || 'rewards-notifications',
};
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'hijack',
  password: process.env.MYSQL_PASSWORD || 'hijack_dev',
  database: process.env.MYSQL_DATABASE || 'hijack_poker',
  connectionLimit: 4,
};

const client = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
  },
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TIERS = [
  { level: 1, name: 'Bronze', minPoints: 0, multiplier: 1.0 },
  { level: 2, name: 'Silver', minPoints: 500, multiplier: 1.25 },
  { level: 3, name: 'Gold', minPoints: 2000, multiplier: 1.5 },
  { level: 4, name: 'Platinum', minPoints: 10000, multiplier: 2.0 },
];

const MILESTONES = [500, 1000, 2000, 10000];

const STAKES = [
  { tableId: 1, tableStakes: '0.10/0.25', bigBlind: 0.25 },
  { tableId: 2, tableStakes: '0.50/1', bigBlind: 1 },
  { tableId: 3, tableStakes: '1/2', bigBlind: 2 },
  { tableId: 4, tableStakes: '2/5', bigBlind: 5 },
  { tableId: 5, tableStakes: '5/10', bigBlind: 10 },
];

const PROFILE_DEFINITIONS = {
  'p1-uuid-0001': {
    monthlyTargets: [120, 180, 240, 210, 160, 135],
    allowedBigBlinds: [0.25, 1, 2],
  },
  'p2-uuid-0002': {
    monthlyTargets: [240, 360, 420, 515, 480, 560],
    allowedBigBlinds: [1, 2, 5],
  },
  'p3-uuid-0003': {
    monthlyTargets: [610, 820, 1150, 1460, 1725, 2150],
    allowedBigBlinds: [2, 5, 10],
  },
  'p4-uuid-0004': {
    monthlyTargets: [950, 1325, 1880, 2350, 2750, 3325],
    allowedBigBlinds: [2, 5, 10],
  },
  'p5-uuid-0005': {
    monthlyTargets: [1800, 2600, 4200, 5600, 8200, 10850],
    allowedBigBlinds: [5, 10],
  },
  'p6-uuid-0006': {
    monthlyTargets: [80, 0, 310, 0, 140, 0],
    allowedBigBlinds: [0.25, 1, 2],
  },
};

function getCurrentMonthStart(referenceDate = new Date()) {
  return new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1, 12, 0, 0));
}

function getMonthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getRecentMonthStarts(count) {
  const currentMonthStart = getCurrentMonthStart();
  return Array.from({ length: count }, (_, index) => {
    const offset = count - index - 1;
    return new Date(
      Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - offset, 1, 12, 0, 0)
    );
  });
}

function getTierByLevel(level) {
  return TIERS.find((tier) => tier.level === level) || TIERS[0];
}

function getTierForPoints(monthlyPoints) {
  for (let index = TIERS.length - 1; index >= 0; index -= 1) {
    if (monthlyPoints >= TIERS[index].minPoints) {
      return TIERS[index];
    }
  }

  return TIERS[0];
}

function getFloorTier(highestTier) {
  return Math.max(1, highestTier - 1);
}

function getBasePoints(bigBlind) {
  if (bigBlind >= 10) {
    return 10;
  }

  if (bigBlind >= 2) {
    return 5;
  }

  if (bigBlind >= 0.5) {
    return 2;
  }

  return 1;
}

function applyMultiplier(basePoints, multiplier) {
  return Math.round(basePoints * multiplier);
}

function getStakeByBlind(bigBlind) {
  const stake = STAKES.find((entry) => entry.bigBlind === bigBlind);
  if (!stake) {
    throw new Error(`Unsupported big blind ${bigBlind}`);
  }

  return stake;
}

function createEventClock(monthStart) {
  let index = 0;

  return function nextEventMoment() {
    const timestampBase = monthStart.getTime() + index * 90 * 60 * 1000;
    const date = new Date(timestampBase);
    const timestamp = timestampBase * 1000 + index;
    index += 1;
    return { date, timestamp };
  };
}

function chooseGameplayStake(allowedBigBlinds, currentTierLevel, remainingPoints) {
  const multiplier = getTierByLevel(currentTierLevel).multiplier;
  const candidates = allowedBigBlinds
    .map((bigBlind) => {
      const stake = getStakeByBlind(bigBlind);
      const basePoints = getBasePoints(bigBlind);
      const earnedPoints = applyMultiplier(basePoints, multiplier);
      return {
        ...stake,
        basePoints,
        earnedPoints,
      };
    })
    .filter((candidate) => candidate.earnedPoints <= remainingPoints)
    .sort((left, right) => {
      if (right.earnedPoints !== left.earnedPoints) {
        return right.earnedPoints - left.earnedPoints;
      }

      return right.bigBlind - left.bigBlind;
    });

  return candidates[0] || null;
}

function createNotification(playerId, notificationId, type, title, description, date) {
  return {
    playerId,
    notificationId,
    type,
    title,
    description,
    dismissed: false,
    createdAt: date.toISOString(),
  };
}

function buildSeedData(mysqlPlayers) {
  const monthStarts = getRecentMonthStarts(6);
  const currentMonthKey = getMonthKey(monthStarts[monthStarts.length - 1]);
  let notificationCounter = 0;
  const seedData = {
    players: [],
    transactions: [],
    leaderboard: [],
    notifications: [],
    summaries: [],
  };

  for (const mysqlPlayer of mysqlPlayers) {
    const profile = PROFILE_DEFINITIONS[mysqlPlayer.guid];
    if (!profile) {
      continue;
    }

    let lifetimePoints = 0;
    let previousMonthHighestTier = 1;
    let previousMonthEndTier = 1;
    let playerCreatedAt = monthStarts[0].toISOString();
    let currentMonthState = null;

    for (const [monthIndex, monthStart] of monthStarts.entries()) {
      const monthKey = getMonthKey(monthStart);
      const monthTarget = profile.monthlyTargets[monthIndex];
      const startTierLevel = monthIndex === 0 ? 1 : getFloorTier(previousMonthHighestTier);
      const eventClock = createEventClock(monthStart);
      const monthNotifications = [];
      const currentMonthTierChangeMoments = [];
      let monthlyPoints = 0;
      let currentTierLevel = startTierLevel;
      let highestTierThisMonth = startTierLevel;
      let gameplayCount = 0;

      if (monthIndex > 0 && startTierLevel < previousMonthEndTier) {
        const { date } = eventClock();
        monthNotifications.push(
          createNotification(
            mysqlPlayer.guid,
            `${getMonthKey(date)}-notification-${String(notificationCounter++).padStart(4, '0')}`,
            'tier_downgrade',
            'Tier Adjusted',
            `Your tier has been adjusted to ${getTierByLevel(startTierLevel).name} for the new month.`,
            date
          )
        );
        currentMonthTierChangeMoments.push(date.toISOString());
      }

      const gameplayLimit = Math.min(40, Math.max(8, Math.ceil(monthTarget / 120)));

      while (monthlyPoints < monthTarget && gameplayCount < gameplayLimit) {
        const remainingPoints = monthTarget - monthlyPoints;
        const stake = chooseGameplayStake(profile.allowedBigBlinds, currentTierLevel, remainingPoints);

        if (!stake) {
          break;
        }

        const { date, timestamp } = eventClock();
        const nextMonthlyPoints = monthlyPoints + stake.earnedPoints;
        const previousLifetimePoints = lifetimePoints;
        const nextLifetimePoints = lifetimePoints + stake.earnedPoints;
        const previousTierLevel = currentTierLevel;
        const derivedTier = getTierForPoints(nextMonthlyPoints);
        const nextTierLevel = Math.max(currentTierLevel, derivedTier.level);

        seedData.transactions.push({
          playerId: mysqlPlayer.guid,
          timestamp,
          type: 'gameplay',
          basePoints: stake.basePoints,
          multiplier: getTierByLevel(previousTierLevel).multiplier,
          earnedPoints: stake.earnedPoints,
          tableId: stake.tableId,
          tableStakes: stake.tableStakes,
          bigBlind: stake.bigBlind,
          handId: `${monthKey}-${mysqlPlayer.guid}-hand-${String(gameplayCount + 1).padStart(3, '0')}`,
          monthKey,
          reason: 'Hand played',
          createdAt: date.toISOString(),
        });

        for (let tierLevel = previousTierLevel + 1; tierLevel <= nextTierLevel; tierLevel += 1) {
          monthNotifications.push(
            createNotification(
              mysqlPlayer.guid,
              `${monthKey}-notification-${String(notificationCounter++).padStart(4, '0')}`,
              'tier_upgrade',
              `Tier Upgrade: ${getTierByLevel(tierLevel).name}`,
              `Congratulations! You've reached ${getTierByLevel(tierLevel).name} tier!`,
              date
            )
          );
          currentMonthTierChangeMoments.push(date.toISOString());
        }

        for (const milestone of MILESTONES) {
          if (previousLifetimePoints < milestone && nextLifetimePoints >= milestone) {
            monthNotifications.push(
              createNotification(
                mysqlPlayer.guid,
                `${monthKey}-notification-${String(notificationCounter++).padStart(4, '0')}`,
                'milestone',
                `Milestone: ${milestone.toLocaleString()} Points`,
                `You've earned ${milestone.toLocaleString()} lifetime points!`,
                date
              )
            );
          }
        }

        monthlyPoints = nextMonthlyPoints;
        lifetimePoints = nextLifetimePoints;
        currentTierLevel = nextTierLevel;
        highestTierThisMonth = Math.max(highestTierThisMonth, nextTierLevel);
        gameplayCount += 1;
      }

      if (monthlyPoints < monthTarget) {
        const remainingPoints = monthTarget - monthlyPoints;
        const { date, timestamp } = eventClock();
        const nextMonthlyPoints = monthlyPoints + remainingPoints;
        const previousLifetimePoints = lifetimePoints;
        const nextLifetimePoints = lifetimePoints + remainingPoints;
        const previousTierLevel = currentTierLevel;
        const nextTierLevel = getTierForPoints(nextMonthlyPoints).level;

        seedData.transactions.push({
          playerId: mysqlPlayer.guid,
          timestamp,
          type: 'adjustment',
          basePoints: remainingPoints,
          multiplier: 1,
          earnedPoints: remainingPoints,
          monthKey,
          reason: 'Seed adjustment to align monthly sample data',
          adminId: 'seed-script',
          createdAt: date.toISOString(),
        });

        for (let tierLevel = previousTierLevel + 1; tierLevel <= nextTierLevel; tierLevel += 1) {
          monthNotifications.push(
            createNotification(
              mysqlPlayer.guid,
              `${monthKey}-notification-${String(notificationCounter++).padStart(4, '0')}`,
              'tier_upgrade',
              `Tier Upgrade: ${getTierByLevel(tierLevel).name}`,
              `Congratulations! You've reached ${getTierByLevel(tierLevel).name} tier!`,
              date
            )
          );
          currentMonthTierChangeMoments.push(date.toISOString());
        }

        for (const milestone of MILESTONES) {
          if (previousLifetimePoints < milestone && nextLifetimePoints >= milestone) {
            monthNotifications.push(
              createNotification(
                mysqlPlayer.guid,
                `${monthKey}-notification-${String(notificationCounter++).padStart(4, '0')}`,
                'milestone',
                `Milestone: ${milestone.toLocaleString()} Points`,
                `You've earned ${milestone.toLocaleString()} lifetime points!`,
                date
              )
            );
          }
        }

        monthlyPoints = nextMonthlyPoints;
        lifetimePoints = nextLifetimePoints;
        currentTierLevel = nextTierLevel;
        highestTierThisMonth = Math.max(highestTierThisMonth, nextTierLevel);
      }

      monthNotifications.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      for (const [index, notification] of monthNotifications.entries()) {
        if (monthKey !== currentMonthKey && index % 2 === 0) {
          notification.dismissed = true;
          notification.dismissedAt = new Date(new Date(notification.createdAt).getTime() + 2 * 60 * 60 * 1000)
            .toISOString();
        }
      }

      seedData.notifications.push(...monthNotifications);
      previousMonthHighestTier = highestTierThisMonth;
      previousMonthEndTier = currentTierLevel;

      if (monthIndex === monthStarts.length - 1) {
        const lastTransactionForMonth = seedData.transactions
          .filter((transaction) => transaction.playerId === mysqlPlayer.guid && transaction.monthKey === monthKey)
          .sort((left, right) => right.timestamp - left.timestamp)[0];

        currentMonthState = {
          playerId: mysqlPlayer.guid,
          displayName: mysqlPlayer.username,
          currentTier: currentTierLevel,
          monthlyPoints,
          lifetimePoints,
          tierFloor: startTierLevel,
          highestTierThisMonth,
          monthKey,
          createdAt: playerCreatedAt,
          updatedAt: lastTransactionForMonth
            ? lastTransactionForMonth.createdAt
            : new Date(monthStart.getTime() + 60 * 60 * 1000).toISOString(),
          lastTierChangeAt:
            currentMonthTierChangeMoments[currentMonthTierChangeMoments.length - 1] || undefined,
        };
      }
    }

    if (!currentMonthState) {
      continue;
    }

    seedData.players.push(currentMonthState);
    if (currentMonthState.monthlyPoints > 0) {
      seedData.leaderboard.push({
        monthKey: currentMonthState.monthKey,
        playerId: currentMonthState.playerId,
        tier: currentMonthState.currentTier,
        monthlyPoints: currentMonthState.monthlyPoints,
      });
    }

    seedData.summaries.push({
      playerId: currentMonthState.playerId,
      displayName: currentMonthState.displayName,
      currentTier: getTierByLevel(currentMonthState.currentTier).name,
      monthlyPoints: currentMonthState.monthlyPoints,
      lifetimePoints: currentMonthState.lifetimePoints,
      notifications: seedData.notifications.filter(
        (notification) => notification.playerId === currentMonthState.playerId
      ).length,
    });
  }

  return seedData;
}

async function fetchPlayers() {
  const pool = mysql.createPool(MYSQL_CONFIG);

  try {
    const [rows] = await pool.query(
      'SELECT guid, username, email FROM players ORDER BY id ASC'
    );

    const requiredGuids = Object.keys(PROFILE_DEFINITIONS);
    const players = rows.filter((row) => requiredGuids.includes(row.guid));
    const missingGuids = requiredGuids.filter(
      (guid) => !players.some((player) => player.guid === guid)
    );

    if (missingGuids.length > 0) {
      throw new Error(`Missing MySQL players for GUIDs: ${missingGuids.join(', ')}`);
    }

    return players;
  } finally {
    await pool.end();
  }
}

async function clearTable(tableName, keyFields) {
  let lastEvaluatedKey;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = [...(result.Items || [])];
    while (items.length > 0) {
      const batch = items.splice(0, 25);
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: batch.map((item) => ({
              DeleteRequest: {
                Key: keyFields.reduce((accumulator, keyField) => {
                  accumulator[keyField] = item[keyField];
                  return accumulator;
                }, {}),
              },
            })),
          },
        })
      );
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
}

async function clearRewardsTables() {
  await clearTable(TABLES.notifications, ['playerId', 'notificationId']);
  await clearTable(TABLES.transactions, ['playerId', 'timestamp']);
  await clearTable(TABLES.leaderboard, ['monthKey', 'playerId']);
  await clearTable(TABLES.players, ['playerId']);
}

async function writeItems(tableName, items) {
  for (const item of items) {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      })
    );
  }
}

async function seed() {
  const mysqlPlayers = await fetchPlayers();
  const seedData = buildSeedData(mysqlPlayers);

  console.log(`Rewards seed source: MySQL ${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port}/${MYSQL_CONFIG.database}`);
  console.log(`DynamoDB endpoint: ${ENDPOINT}`);
  console.log(`Players in seed set: ${seedData.players.length}`);

  for (const summary of seedData.summaries) {
    console.log(
      `  ${summary.displayName} (${summary.playerId}) -> ${summary.currentTier}, ` +
      `${summary.monthlyPoints} monthly, ${summary.lifetimePoints} lifetime, ` +
      `${summary.notifications} notifications`
    );
  }

  if (DRY_RUN) {
    console.log('Dry run complete. No DynamoDB writes were made.');
    return;
  }

  await clearRewardsTables();
  await writeItems(TABLES.players, seedData.players);
  await writeItems(TABLES.transactions, seedData.transactions);
  await writeItems(TABLES.leaderboard, seedData.leaderboard);
  await writeItems(TABLES.notifications, seedData.notifications);

  console.log(
    `Seeded ${seedData.players.length} players, ${seedData.transactions.length} transactions, ` +
    `${seedData.leaderboard.length} leaderboard rows, and ${seedData.notifications.length} notifications.`
  );
}

seed().catch((error) => {
  console.error('Rewards seed failed:', error.message);
  process.exit(1);
});
