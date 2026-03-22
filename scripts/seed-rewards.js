#!/usr/bin/env node

/**
 * Seed rewards DynamoDB tables with sample data matching the challenge spec.
 *
 * Creates 50 players across all tiers with point history, leaderboard entries,
 * and notifications. Run after `docker compose --profile rewards up`.
 *
 * Usage: node scripts/seed-rewards.js
 */

'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
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

const NAMES = [
  'Ace_High', 'RiverRat', 'PocketKings', 'BluffMaster', 'NutFlush',
  'CheckRaise', 'FullBoat', 'SetMiner', 'OverBet', 'ValueTown',
  'FloatPlay', 'TripleBarel', 'SqueezePot', 'ColdCall', 'ThreeWay',
  'HeadsUp', 'UTG_Open', 'BtnSteal', 'CutOff', 'SmallBlind',
  'BigBlind', 'Straddle', 'RunItTwice', 'AllInPre', 'SuckOut',
  'BadBeat', 'CoinFlip', 'Domination', 'DrawingDead', 'Freeroll',
  'Satellite', 'BountyHunt', 'KnockOut', 'FinalTable', 'BubbleBoy',
  'ChipLeader', 'ShortStack', 'BigStack', 'MiddleStack', 'DeepRun',
  'GrindMode', 'NitReg', 'LAG_Life', 'TAG_Player', 'ManiacMode',
  'RockSolid', 'LooseCall', 'TightFold', 'MixedGame', 'ActionJunkie',
];

const TABLE_STAKES = [
  { stakes: '0.10/0.25', bigBlind: 0.25, basePoints: 1 },
  { stakes: '0.50/1', bigBlind: 1, basePoints: 2 },
  { stakes: '1/2', bigBlind: 2, basePoints: 5 },
  { stakes: '2/5', bigBlind: 5, basePoints: 5 },
  { stakes: '5/10', bigBlind: 10, basePoints: 10 },
];

function getTier(monthlyPoints) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (monthlyPoints >= TIERS[i].minPoints) return TIERS[i];
  }
  return TIERS[0];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function seed() {
  console.log(`Seeding rewards data to ${ENDPOINT}...`);
  const monthKey = getCurrentMonthKey();
  let playerCount = 0;
  let txCount = 0;

  for (let i = 0; i < 50; i++) {
    const playerId = `player-${String(i + 1).padStart(3, '0')}`;
    const monthlyPoints = randomInt(0, 15000);
    const lifetimePoints = monthlyPoints + randomInt(0, 20000);
    const tier = getTier(monthlyPoints);

    // Insert player profile
    await docClient.send(
      new PutCommand({
        TableName: 'rewards-players',
        Item: {
          playerId,
          displayName: NAMES[i],
          currentTier: tier.level,
          monthlyPoints,
          lifetimePoints,
          tierFloor: Math.max(1, tier.level - 1),
          highestTierThisMonth: tier.level,
          monthKey,
          createdAt: new Date(Date.now() - randomInt(30, 365) * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    );
    playerCount++;

    // Insert leaderboard entry
    await docClient.send(
      new PutCommand({
        TableName: 'rewards-leaderboard',
        Item: {
          monthKey,
          playerId,
          displayName: NAMES[i],
          tier: tier.level,
          monthlyPoints,
        },
      })
    );

    // Insert 10-20 recent transactions
    const numTx = randomInt(10, 20);
    for (let j = 0; j < numTx; j++) {
      const stake = TABLE_STAKES[randomInt(0, TABLE_STAKES.length - 1)];
      const multiplier = tier.multiplier;
      const earnedPoints = Math.round(stake.basePoints * multiplier);

      await docClient.send(
        new PutCommand({
          TableName: 'rewards-transactions',
          Item: {
            playerId,
            timestamp: Date.now() - randomInt(0, 30 * 86400000) + j,
            type: 'gameplay',
            basePoints: stake.basePoints,
            multiplier,
            earnedPoints,
            tableId: randomInt(1, 10),
            tableStakes: stake.stakes,
            bigBlind: stake.bigBlind,
            handId: `hand-${Date.now()}-${j}`,
            monthKey,
            reason: 'Hand played',
            createdAt: new Date(Date.now() - randomInt(0, 30) * 86400000).toISOString(),
          },
        })
      );
      txCount++;
    }

    // Add a tier upgrade notification for players Silver+
    if (tier.level >= 2) {
      await docClient.send(
        new PutCommand({
          TableName: 'rewards-notifications',
          Item: {
            playerId,
            notificationId: `notif-${Date.now()}-${i}`,
            type: 'tier_upgrade',
            title: `Tier Upgrade: ${tier.name}`,
            description: `Congratulations! You've reached ${tier.name} tier!`,
            dismissed: i % 3 === 0,
            createdAt: new Date(Date.now() - randomInt(0, 7) * 86400000).toISOString(),
          },
        })
      );
    }

    // Add milestone notification for high-point players
    if (lifetimePoints >= 5000) {
      await docClient.send(
        new PutCommand({
          TableName: 'rewards-notifications',
          Item: {
            playerId,
            notificationId: `notif-milestone-${Date.now()}-${i}`,
            type: 'milestone',
            title: 'Milestone: 5,000 Points',
            description: "You've earned 5,000 lifetime points!",
            dismissed: false,
            createdAt: new Date(Date.now() - randomInt(0, 14) * 86400000).toISOString(),
          },
        })
      );
    }
  }

  console.log(`Seeded ${playerCount} players and ${txCount} transactions.`);
  console.log(`Leaderboard entries and notifications also created.`);
  console.log('Done!');
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
