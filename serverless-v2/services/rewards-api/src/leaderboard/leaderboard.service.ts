import { Injectable } from '@nestjs/common';

import { getCurrentMonthKey, getTierByLevel } from '../config/rewards.config';
import { RankedEntry } from '../config/rewards.types';
import { DynamoService } from '../dynamo/dynamo.service';
import { IdentityService } from '../identity/identity.service';
import { RewardsStateService } from '../reconciliation/rewards-state.service';

interface RankedRow {
  playerId: string;
  tierLevel: number;
  monthlyPoints: number;
  rank: number;
}

export function buildCompetitionRanking(
  entries: Array<{ playerId: string; tier: number; monthlyPoints: number }>
) {
  const sorted = [...entries].sort((left, right) => {
    if (right.monthlyPoints !== left.monthlyPoints) {
      return right.monthlyPoints - left.monthlyPoints;
    }

    return left.playerId.localeCompare(right.playerId);
  });

  let lastPoints: number | null = null;
  let lastRank = 0;

  return sorted.map((entry, index) => {
    if (entry.monthlyPoints !== lastPoints) {
      lastRank = index + 1;
      lastPoints = entry.monthlyPoints;
    }

    return {
      playerId: entry.playerId,
      tierLevel: entry.tier,
      monthlyPoints: entry.monthlyPoints,
      rank: lastRank,
    };
  });
}

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly dynamoService: DynamoService,
    private readonly identityService: IdentityService,
    private readonly rewardsStateService: RewardsStateService
  ) {}

  async getPlayerLeaderboard(requestingPlayerId: string, limit: number) {
    await this.rewardsStateService.getOrCreateReconciledPlayer(requestingPlayerId);
    const monthKey = getCurrentMonthKey();
    const rankedRows = buildCompetitionRanking(await this.dynamoService.getLeaderboard(monthKey));
    const leaderboard = await Promise.all(
      rankedRows.slice(0, limit).map((row) => this.toRankedEntry(row))
    );

    const requestingRank = rankedRows.find((row) => row.playerId === requestingPlayerId);

    return {
      monthKey,
      leaderboard,
      playerRank: requestingRank ? await this.toRankedEntry(requestingRank) : null,
    };
  }

  async getAdminLeaderboard() {
    const monthKey = getCurrentMonthKey();
    const rankedRows = buildCompetitionRanking(await this.dynamoService.getLeaderboard(monthKey));
    const leaderboard = await Promise.all(
      rankedRows.map(async (row) => {
        const identity = await this.identityService.findPlayerIdentity(row.playerId);
        const player = await this.dynamoService.getPlayer(row.playerId);

        return {
          rank: row.rank,
          playerId: row.playerId,
          displayName: player?.displayName ?? identity?.username ?? row.playerId,
          tier: getTierByLevel(row.tierLevel).name,
          tierLevel: row.tierLevel,
          monthlyPoints: row.monthlyPoints,
          email: identity?.email ?? null,
        };
      })
    );

    return {
      monthKey,
      leaderboard,
    };
  }

  private async toRankedEntry(row: RankedRow): Promise<RankedEntry> {
    const player = await this.dynamoService.getPlayer(row.playerId);

    return {
      rank: row.rank,
      playerId: row.playerId,
      displayName: player?.displayName ?? row.playerId,
      tier: getTierByLevel(row.tierLevel).name,
      monthlyPoints: row.monthlyPoints,
    };
  }
}
