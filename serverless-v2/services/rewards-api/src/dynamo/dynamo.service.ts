import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { Injectable, Inject } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import {
  LeaderboardEntryEntity,
  NotificationEntity,
  PlayerEntity,
  TransactionEntity,
} from '../config/rewards.types';

interface RewardsTables {
  players: string;
  transactions: string;
  leaderboard: string;
  notifications: string;
}

@Injectable()
export class DynamoService {
  private readonly client: DynamoDBClient;

  private readonly docClient: DynamoDBDocumentClient;

  constructor(@Inject('REWARDS_TABLES') private readonly tables: RewardsTables) {
    const clientConfig: ConstructorParameters<typeof DynamoDBClient>[0] = {
      region: process.env.AWS_REGION ?? 'us-east-1',
    };

    if (process.env.DYNAMODB_ENDPOINT) {
      clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
      clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'local',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'local',
      };
    }

    this.client = new DynamoDBClient(clientConfig);
    this.docClient = DynamoDBDocumentClient.from(this.client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async getPlayer(playerId: string) {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tables.players,
        Key: { playerId },
      })
    );

    return (result.Item as PlayerEntity | undefined) ?? null;
  }

  async putPlayer(player: PlayerEntity) {
    await this.docClient.send(
      new PutCommand({
        TableName: this.tables.players,
        Item: player,
      })
    );
  }

  async updatePlayer(playerId: string, updates: Partial<PlayerEntity>) {
    const entries = Object.entries(updates);
    if (!entries.length) {
      return;
    }

    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const expression = entries.map(([key, value], index) => {
      const nameKey = `#k${index}`;
      const valueKey = `:v${index}`;
      names[nameKey] = key;
      values[valueKey] = value;
      return `${nameKey} = ${valueKey}`;
    });

    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tables.players,
        Key: { playerId },
        UpdateExpression: `SET ${expression.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: 'attribute_exists(playerId)',
      })
    );
  }

  async scanPlayers() {
    const items: PlayerEntity[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await this.docClient.send(
        new ScanCommand({
          TableName: this.tables.players,
          ExclusiveStartKey: lastKey,
        })
      );

      items.push(...((result.Items as PlayerEntity[] | undefined) ?? []));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  }

  async addTransaction(transaction: TransactionEntity) {
    await this.docClient.send(
      new PutCommand({
        TableName: this.tables.transactions,
        Item: transaction,
      })
    );
  }

  async getAllTransactions(playerId: string) {
    const items: TransactionEntity[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tables.transactions,
          KeyConditionExpression: 'playerId = :playerId',
          ExpressionAttributeValues: { ':playerId': playerId },
          ExclusiveStartKey: lastKey,
          ScanIndexForward: false,
        })
      );

      items.push(...((result.Items as TransactionEntity[] | undefined) ?? []));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return items;
  }

  async putLeaderboardEntry(entry: LeaderboardEntryEntity) {
    await this.docClient.send(
      new PutCommand({
        TableName: this.tables.leaderboard,
        Item: entry,
      })
    );
  }

  async deleteLeaderboardEntry(monthKey: string, playerId: string) {
    await this.docClient.send(
      new DeleteCommand({
        TableName: this.tables.leaderboard,
        Key: { monthKey, playerId },
      })
    );
  }

  async getLeaderboard(monthKey: string) {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tables.leaderboard,
        KeyConditionExpression: 'monthKey = :monthKey',
        ExpressionAttributeValues: { ':monthKey': monthKey },
      })
    );

    return (result.Items as LeaderboardEntryEntity[] | undefined) ?? [];
  }

  async addNotification(notification: NotificationEntity) {
    await this.docClient.send(
      new PutCommand({
        TableName: this.tables.notifications,
        Item: notification,
      })
    );
  }

  async getNotifications(playerId: string, unreadOnly = false) {
    const items: NotificationEntity[] = [];
    let lastKey: Record<string, unknown> | undefined;

    do {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tables.notifications,
          KeyConditionExpression: 'playerId = :playerId',
          ExpressionAttributeValues: { ':playerId': playerId },
          ExclusiveStartKey: lastKey,
          ScanIndexForward: false,
        })
      );

      items.push(...((result.Items as NotificationEntity[] | undefined) ?? []));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);

    return unreadOnly ? items.filter((item) => !item.dismissed) : items;
  }

  async dismissNotification(playerId: string, notificationId: string) {
    await this.docClient.send(
      new UpdateCommand({
        TableName: this.tables.notifications,
        Key: { playerId, notificationId },
        UpdateExpression: 'SET dismissed = :dismissed, dismissedAt = :dismissedAt',
        ExpressionAttributeValues: {
          ':dismissed': true,
          ':dismissedAt': new Date().toISOString(),
        },
        ConditionExpression: 'attribute_exists(playerId) AND attribute_exists(notificationId)',
      })
    );
  }

  async clearTable(tableName: string, keyFields: string[]) {
    const scanResult = await this.docClient.send(new ScanCommand({ TableName: tableName }));
    const items = scanResult.Items ?? [];

    while (items.length) {
      const batch = items.splice(0, 25);
      await this.docClient.send(
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
  }
}
