import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CreateTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

import { AppModule } from '../src/app.module';

const tables = {
  players: process.env.REWARDS_PLAYERS_TABLE ?? 'rewards-players',
  transactions: process.env.REWARDS_TRANSACTIONS_TABLE ?? 'rewards-transactions',
  leaderboard: process.env.REWARDS_LEADERBOARD_TABLE ?? 'rewards-leaderboard',
  notifications: process.env.REWARDS_NOTIFICATIONS_TABLE ?? 'rewards-notifications',
};

const rawClient = new DynamoDBClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'local',
  },
});

const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true },
});

export const rewardsTestTables = tables;

async function createTable(command: CreateTableCommand) {
  try {
    await rawClient.send(command);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'ResourceInUseException'
    ) {
      return;
    }

    throw error;
  }
}

async function clearTable(tableName: string, keyFields: string[]) {
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey,
      })
    );

    const items = [...(result.Items ?? [])];
    while (items.length) {
      const batch = items.splice(0, 25);
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: batch.map((item) => ({
              DeleteRequest: {
                Key: keyFields.reduce<Record<string, unknown>>((accumulator, key) => {
                  accumulator[key] = item[key];
                  return accumulator;
                }, {}),
              },
            })),
          },
        })
      );
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
}

export async function ensureRewardsTables() {
  await createTable(
    new CreateTableCommand({
      TableName: tables.players,
      AttributeDefinitions: [{ AttributeName: 'playerId', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'playerId', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );

  await createTable(
    new CreateTableCommand({
      TableName: tables.transactions,
      AttributeDefinitions: [
        { AttributeName: 'playerId', AttributeType: 'S' },
        { AttributeName: 'timestamp', AttributeType: 'N' },
      ],
      KeySchema: [
        { AttributeName: 'playerId', KeyType: 'HASH' },
        { AttributeName: 'timestamp', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );

  await createTable(
    new CreateTableCommand({
      TableName: tables.leaderboard,
      AttributeDefinitions: [
        { AttributeName: 'monthKey', AttributeType: 'S' },
        { AttributeName: 'playerId', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'monthKey', KeyType: 'HASH' },
        { AttributeName: 'playerId', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );

  await createTable(
    new CreateTableCommand({
      TableName: tables.notifications,
      AttributeDefinitions: [
        { AttributeName: 'playerId', AttributeType: 'S' },
        { AttributeName: 'notificationId', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'playerId', KeyType: 'HASH' },
        { AttributeName: 'notificationId', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    })
  );
}

export async function resetRewardsTables() {
  await clearTable(tables.notifications, ['playerId', 'notificationId']);
  await clearTable(tables.transactions, ['playerId', 'timestamp']);
  await clearTable(tables.leaderboard, ['monthKey', 'playerId']);
  await clearTable(tables.players, ['playerId']);
}

export async function putRewardsTestItem(tableName: string, item: Record<string, unknown>) {
  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    })
  );
}

export async function createTestingApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );
  await app.init();

  return app;
}
