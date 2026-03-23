export interface TierConfig {
  level: number;
  name: string;
  minPoints: number;
  multiplier: number;
}

export interface PlayerEntity {
  playerId: string;
  displayName: string;
  currentTier: number;
  monthlyPoints: number;
  lifetimePoints: number;
  tierFloor: number;
  highestTierThisMonth: number;
  monthKey: string;
  lastTierChangeAt?: string;
  overrideTier?: number;
  overrideExpiresAt?: string;
  overrideReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionEntity {
  playerId: string;
  timestamp: number;
  type: 'gameplay' | 'adjustment' | 'bonus';
  basePoints: number;
  multiplier: number;
  earnedPoints: number;
  tableId?: number;
  tableStakes?: string;
  bigBlind?: number;
  handId?: string;
  monthKey: string;
  reason: string;
  adminId?: string;
  createdAt: string;
}

export interface LeaderboardEntryEntity {
  monthKey: string;
  playerId: string;
  tier: number;
  monthlyPoints: number;
}

export interface NotificationEntity {
  playerId: string;
  notificationId: string;
  type: 'tier_upgrade' | 'tier_downgrade' | 'milestone';
  title: string;
  description: string;
  dismissed: boolean;
  createdAt: string;
  dismissedAt?: string;
}

export interface MySqlPlayerIdentity {
  guid: string;
  username: string;
  email: string | null;
}

export interface RankedEntry {
  rank: number;
  playerId: string;
  displayName: string;
  tier: string;
  monthlyPoints: number;
}
