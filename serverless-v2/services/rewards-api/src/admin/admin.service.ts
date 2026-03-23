import { Injectable } from '@nestjs/common';

import { AdjustPointsDto } from '../common/dto/adjust-points.dto';
import { MonthlyResetDto } from '../common/dto/monthly-reset.dto';
import { TierOverrideDto } from '../common/dto/tier-override.dto';
import { getNextTier, getTierByLevel } from '../config/rewards.config';
import { DynamoService } from '../dynamo/dynamo.service';
import { IdentityService } from '../identity/identity.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlayerService } from '../player/player.service';
import { PointsService } from '../points/points.service';
import { RewardsStateService } from '../reconciliation/rewards-state.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly dynamoService: DynamoService,
    private readonly identityService: IdentityService,
    private readonly leaderboardService: LeaderboardService,
    private readonly notificationsService: NotificationsService,
    private readonly playerService: PlayerService,
    private readonly pointsService: PointsService,
    private readonly rewardsStateService: RewardsStateService
  ) {}

  async getPlayerRewards(playerId: string) {
    const player = await this.rewardsStateService.getKnownPlayerOrThrow(playerId);
    const transactions = await this.dynamoService.getAllTransactions(playerId);
    const notifications = await this.notificationsService.getNotifications(playerId);
    const identity = await this.identityService.findPlayerIdentity(playerId);
    const currentTier = getTierByLevel(player.currentTier);
    const nextTier = getNextTier(player.currentTier);

    return {
      playerId: player.playerId,
      displayName: player.displayName,
      currentTier: currentTier.name,
      tierLevel: currentTier.level,
      multiplier: currentTier.multiplier,
      monthlyPoints: player.monthlyPoints,
      lifetimePoints: player.lifetimePoints,
      tierFloor: player.tierFloor,
      highestTierThisMonth: player.highestTierThisMonth,
      monthKey: player.monthKey,
      email: identity?.email ?? null,
      nextTierTarget: nextTier?.minPoints ?? null,
      pointsToNextTier: nextTier ? Math.max(0, nextTier.minPoints - player.monthlyPoints) : 0,
      recentTransactions: transactions.slice(0, 20),
      notifications,
      overrideTier: player.overrideTier ?? null,
      overrideExpiresAt: player.overrideExpiresAt ?? null,
      overrideReason: player.overrideReason ?? null,
    };
  }

  async adjustPoints(payload: AdjustPointsDto, adminId: string) {
    return this.pointsService.adjustPoints(payload, adminId);
  }

  async getLeaderboard() {
    return this.leaderboardService.getAdminLeaderboard();
  }

  async overrideTier(payload: TierOverrideDto) {
    const player = await this.rewardsStateService.getKnownPlayerOrThrow(payload.playerId);
    const now = new Date().toISOString();
    await this.dynamoService.updatePlayer(player.playerId, {
      currentTier: payload.tierLevel,
      overrideTier: payload.tierLevel,
      overrideExpiresAt: payload.expiresAt ?? undefined,
      overrideReason: payload.reason ?? 'Admin override',
      updatedAt: now,
      lastTierChangeAt: now,
    });

    return {
      playerId: player.playerId,
      overrideTier: getTierByLevel(payload.tierLevel).name,
      overrideTierLevel: payload.tierLevel,
      expiresAt: payload.expiresAt ?? null,
    };
  }

  async monthlyReset(payload: MonthlyResetDto) {
    const resetCount = await this.rewardsStateService.resetAllPlayers(payload.monthKey);
    return {
      monthKey: payload.monthKey ?? null,
      resetCount,
    };
  }
}
