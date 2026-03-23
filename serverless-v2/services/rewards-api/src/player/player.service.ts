import { Injectable } from '@nestjs/common';

import { getNextTier, getTierByLevel } from '../config/rewards.config';
import { DynamoService } from '../dynamo/dynamo.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RewardsStateService } from '../reconciliation/rewards-state.service';

@Injectable()
export class PlayerService {
  constructor(
    private readonly dynamoService: DynamoService,
    private readonly notificationsService: NotificationsService,
    private readonly rewardsStateService: RewardsStateService
  ) {}

  async getSummary(playerId: string) {
    const player = await this.rewardsStateService.getOrCreateReconciledPlayer(playerId);
    const currentTier = getTierByLevel(player.currentTier);
    const nextTier = getNextTier(player.currentTier);
    const unreadNotifications = await this.notificationsService.getUnreadCount(playerId);
    const transactions = await this.dynamoService.getAllTransactions(playerId);

    return {
      playerId: player.playerId,
      displayName: player.displayName,
      currentTier: currentTier.name,
      tierLevel: currentTier.level,
      multiplier: currentTier.multiplier,
      monthlyPoints: player.monthlyPoints,
      lifetimePoints: player.lifetimePoints,
      nextTierTarget: nextTier?.minPoints ?? null,
      pointsToNextTier: nextTier ? Math.max(0, nextTier.minPoints - player.monthlyPoints) : 0,
      unreadNotifications,
      recentTimeline: transactions.slice(0, 5).map((transaction) => ({
        timestamp: transaction.timestamp,
        type: transaction.type,
        earnedPoints: transaction.earnedPoints,
        reason: transaction.reason,
      })),
    };
  }

  async getHistory(playerId: string, limit: number, offset: number) {
    await this.rewardsStateService.getOrCreateReconciledPlayer(playerId);
    const transactions = await this.dynamoService.getAllTransactions(playerId);
    const paginated = transactions.slice(offset, offset + limit);

    return {
      transactions: paginated.map((transaction) => ({
        timestamp: transaction.timestamp,
        type: transaction.type,
        tableId: transaction.tableId ?? null,
        tableStakes: transaction.tableStakes ?? '',
        basePoints: transaction.basePoints,
        multiplier: transaction.multiplier,
        earnedPoints: transaction.earnedPoints,
        reason: transaction.reason,
        createdAt: transaction.createdAt,
      })),
      total: transactions.length,
      limit,
      offset,
    };
  }
}
