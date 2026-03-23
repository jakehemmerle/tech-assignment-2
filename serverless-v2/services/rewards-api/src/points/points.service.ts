import { Injectable } from '@nestjs/common';

import {
  applyMultiplier,
  getBasePoints,
  getCurrentMonthKey,
  getNextTier,
  getTierByLevel,
  getTierForPoints,
} from '../config/rewards.config';
import { TransactionEntity } from '../config/rewards.types';
import { DynamoService } from '../dynamo/dynamo.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RewardsStateService } from '../reconciliation/rewards-state.service';
import { AdjustPointsDto } from '../common/dto/adjust-points.dto';
import { AwardPointsDto } from '../common/dto/award-points.dto';

function generateTransactionTimestamp() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

@Injectable()
export class PointsService {
  constructor(
    private readonly dynamoService: DynamoService,
    private readonly notificationsService: NotificationsService,
    private readonly rewardsStateService: RewardsStateService
  ) {}

  async awardPoints(payload: AwardPointsDto, adminId: string) {
    const player = await this.rewardsStateService.getOrCreateReconciledPlayer(payload.playerId);
    const activeTier = getTierByLevel(player.currentTier);
    const basePoints = getBasePoints(payload.bigBlind);
    const earnedPoints = applyMultiplier(basePoints, activeTier.multiplier);
    const currentMonthKey = getCurrentMonthKey();

    const transaction: TransactionEntity = {
      playerId: payload.playerId,
      timestamp: generateTransactionTimestamp(),
      type: 'gameplay',
      basePoints,
      multiplier: activeTier.multiplier,
      earnedPoints,
      tableId: payload.tableId,
      tableStakes: payload.tableStakes,
      bigBlind: payload.bigBlind,
      handId: payload.handId,
      monthKey: currentMonthKey,
      reason: 'Hand played',
      adminId,
      createdAt: new Date().toISOString(),
    };

    await this.dynamoService.addTransaction(transaction);

    const newMonthlyPoints = player.monthlyPoints + earnedPoints;
    const newLifetimePoints = player.lifetimePoints + earnedPoints;
    const derivedTier = getTierForPoints(newMonthlyPoints);
    const newTierLevel = Math.max(player.currentTier, derivedTier.level);
    const nextTier = getNextTier(newTierLevel);
    const highestTierThisMonth = Math.max(player.highestTierThisMonth, newTierLevel);
    const updates = {
      monthlyPoints: newMonthlyPoints,
      lifetimePoints: newLifetimePoints,
      currentTier: newTierLevel,
      highestTierThisMonth,
      updatedAt: new Date().toISOString(),
      ...(newTierLevel > player.currentTier
        ? { lastTierChangeAt: new Date().toISOString() }
        : {}),
    };

    await this.dynamoService.updatePlayer(player.playerId, updates);
    await this.syncLeaderboard(player.playerId, currentMonthKey, newMonthlyPoints, newTierLevel);

    if (newTierLevel > player.currentTier) {
      await this.notificationsService.createTierUpgrade(
        player.playerId,
        getTierByLevel(newTierLevel).name
      );
    }

    await this.notificationsService.checkMilestones(
      player.playerId,
      player.lifetimePoints,
      newLifetimePoints
    );

    return {
      playerId: player.playerId,
      earnedPoints,
      basePoints,
      multiplier: activeTier.multiplier,
      monthlyPoints: newMonthlyPoints,
      lifetimePoints: newLifetimePoints,
      currentTier: getTierByLevel(newTierLevel).name,
      nextTierTarget: nextTier?.minPoints ?? null,
      pointsToNextTier: nextTier ? Math.max(0, nextTier.minPoints - newMonthlyPoints) : 0,
      transaction,
    };
  }

  async adjustPoints(payload: AdjustPointsDto, adminId: string) {
    const player = await this.rewardsStateService.getOrCreateReconciledPlayer(payload.playerId);
    const currentMonthKey = getCurrentMonthKey();
    const nextMonthlyPoints = Math.max(0, player.monthlyPoints + payload.points);
    const nextLifetimePoints = Math.max(0, player.lifetimePoints + payload.points);
    const nextTier = getTierForPoints(nextMonthlyPoints);

    const transaction: TransactionEntity = {
      playerId: payload.playerId,
      timestamp: generateTransactionTimestamp(),
      type: 'adjustment',
      basePoints: Math.abs(payload.points),
      multiplier: 1,
      earnedPoints: payload.points,
      monthKey: currentMonthKey,
      reason: payload.reason,
      adminId,
      createdAt: new Date().toISOString(),
    };

    await this.dynamoService.addTransaction(transaction);
    await this.dynamoService.updatePlayer(player.playerId, {
      monthlyPoints: nextMonthlyPoints,
      lifetimePoints: nextLifetimePoints,
      currentTier: nextTier.level,
      highestTierThisMonth: Math.max(player.highestTierThisMonth, nextTier.level),
      updatedAt: new Date().toISOString(),
    });

    await this.syncLeaderboard(player.playerId, currentMonthKey, nextMonthlyPoints, nextTier.level);

    return {
      playerId: player.playerId,
      adjustedPoints: payload.points,
      monthlyPoints: nextMonthlyPoints,
      lifetimePoints: nextLifetimePoints,
      currentTier: nextTier.name,
    };
  }

  private async syncLeaderboard(
    playerId: string,
    monthKey: string,
    monthlyPoints: number,
    tierLevel: number
  ) {
    if (monthlyPoints <= 0) {
      await this.dynamoService.deleteLeaderboardEntry(monthKey, playerId);
      return;
    }

    await this.dynamoService.putLeaderboardEntry({
      monthKey,
      playerId,
      tier: tierLevel,
      monthlyPoints,
    });
  }
}
