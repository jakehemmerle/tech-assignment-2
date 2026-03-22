import apiClient from './client';

export interface RewardsSummary {
  playerId: string;
  displayName: string;
  currentTier: string;
  tierLevel: number;
  multiplier: number;
  monthlyPoints: number;
  lifetimePoints: number;
  nextTierTarget: number | null;
  pointsToNextTier: number;
  unreadNotifications: number;
  recentTimeline: TimelineEntry[];
}

export interface TimelineEntry {
  timestamp: number;
  type: string;
  earnedPoints: number;
  reason: string;
}

export interface Transaction {
  timestamp: number;
  type: string;
  tableId: number | null;
  tableStakes: string;
  basePoints: number;
  multiplier: number;
  earnedPoints: number;
  reason: string;
  createdAt: string;
}

export interface HistoryResponse {
  transactions: Transaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  displayName: string;
  tier: string;
  monthlyPoints: number;
}

export interface LeaderboardResponse {
  monthKey: string;
  leaderboard: LeaderboardEntry[];
  playerRank: LeaderboardEntry | null;
}

export interface Notification {
  notificationId: string;
  type: string;
  title: string;
  description: string;
  dismissed: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
}

export const rewardsApi = {
  getSummary: () => apiClient.get<RewardsSummary>('/player/rewards').then((r) => r.data),

  getHistory: (limit = 20, offset = 0) =>
    apiClient.get<HistoryResponse>(`/player/rewards/history?limit=${limit}&offset=${offset}`).then((r) => r.data),

  getLeaderboard: (limit = 10) =>
    apiClient.get<LeaderboardResponse>(`/leaderboard?limit=${limit}`).then((r) => r.data),

  getNotifications: (unread = false) =>
    apiClient.get<NotificationsResponse>(`/player/notifications?unread=${unread}`).then((r) => r.data),

  dismissNotification: (id: string) =>
    apiClient.patch(`/player/notifications/${id}/dismiss`).then((r) => r.data),
};
