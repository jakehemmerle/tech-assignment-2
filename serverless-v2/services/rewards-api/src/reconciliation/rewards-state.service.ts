import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  getCurrentMonthKey,
  getFloorTier,
  getTierByLevel,
} from '../config/rewards.config';
import { PlayerEntity } from '../config/rewards.types';
import { DynamoService } from '../dynamo/dynamo.service';
import { IdentityService } from '../identity/identity.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RewardsStateService {
  constructor(
    private readonly dynamoService: DynamoService,
    private readonly identityService: IdentityService,
    private readonly notificationsService: NotificationsService
  ) {}

  async getExistingPlayer(playerId: string) {
    return this.dynamoService.getPlayer(playerId);
  }

  async ensurePlayer(playerId: string) {
    let player = await this.dynamoService.getPlayer(playerId);

    if (!player) {
      const displayName = await this.identityService.resolveDisplayName(playerId);
      const now = new Date().toISOString();
      player = {
        playerId,
        displayName,
        currentTier: 1,
        monthlyPoints: 0,
        lifetimePoints: 0,
        tierFloor: 1,
        highestTierThisMonth: 1,
        monthKey: getCurrentMonthKey(),
        createdAt: now,
        updatedAt: now,
      };
      await this.dynamoService.putPlayer(player);
      return player;
    }

    return this.syncDisplayName(player);
  }

  async getOrCreateReconciledPlayer(playerId: string) {
    const player = await this.ensurePlayer(playerId);
    return this.reconcilePlayer(player);
  }

  async getKnownPlayerOrThrow(playerId: string) {
    const existingPlayer = await this.dynamoService.getPlayer(playerId);
    if (existingPlayer) {
      return this.reconcilePlayer(await this.syncDisplayName(existingPlayer));
    }

    const identity = await this.identityService.findPlayerIdentity(playerId);
    if (!identity) {
      throw new NotFoundException('Player not found');
    }

    const created = await this.ensurePlayer(playerId);
    return this.reconcilePlayer(created);
  }

  async reconcilePlayer(player: PlayerEntity) {
    const currentMonthKey = getCurrentMonthKey();
    if (player.monthKey === currentMonthKey) {
      return player;
    }

    return this.resetPlayer(player, currentMonthKey);
  }

  async resetPlayer(player: PlayerEntity, targetMonthKey = getCurrentMonthKey()) {
    const highestTier = player.highestTierThisMonth || player.currentTier;
    const floorTier = getFloorTier(highestTier);
    const now = new Date().toISOString();
    const updates: Partial<PlayerEntity> = {
      monthlyPoints: 0,
      monthKey: targetMonthKey,
      currentTier: floorTier,
      tierFloor: floorTier,
      highestTierThisMonth: floorTier,
      updatedAt: now,
    };

    if (floorTier < player.currentTier) {
      updates.lastTierChangeAt = now;
    }

    await this.dynamoService.updatePlayer(player.playerId, updates);

    if (floorTier < player.currentTier) {
      await this.notificationsService.createTierDowngrade(
        player.playerId,
        getTierByLevel(floorTier).name
      );
    }

    return {
      ...player,
      ...updates,
    };
  }

  async resetAllPlayers(targetMonthKey = getCurrentMonthKey()) {
    const players = await this.dynamoService.scanPlayers();
    let resetCount = 0;

    for (const player of players) {
      if (player.monthKey !== targetMonthKey) {
        await this.resetPlayer(player, targetMonthKey);
        resetCount += 1;
      }
    }

    return resetCount;
  }

  private async syncDisplayName(player: PlayerEntity) {
    const displayName = await this.identityService.resolveDisplayName(player.playerId);
    if (displayName === player.displayName) {
      return player;
    }

    const updatedAt = new Date().toISOString();
    await this.dynamoService.updatePlayer(player.playerId, {
      displayName,
      updatedAt,
    });

    return {
      ...player,
      displayName,
      updatedAt,
    };
  }
}
