import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { MILESTONES } from '../config/rewards.config';
import { DynamoService } from '../dynamo/dynamo.service';

function makeNotificationId() {
  const timestamp = String(Date.now()).padStart(13, '0');
  return `${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
}

function isConditionalCheckFailed(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'ConditionalCheckFailedException'
  );
}

@Injectable()
export class NotificationsService {
  constructor(private readonly dynamoService: DynamoService) {}

  async createTierUpgrade(playerId: string, tierName: string) {
    await this.dynamoService.addNotification({
      playerId,
      notificationId: makeNotificationId(),
      type: 'tier_upgrade',
      title: `Tier Upgrade: ${tierName}`,
      description: `Congratulations! You've reached ${tierName} tier!`,
      dismissed: false,
      createdAt: new Date().toISOString(),
    });
  }

  async createTierDowngrade(playerId: string, tierName: string) {
    await this.dynamoService.addNotification({
      playerId,
      notificationId: makeNotificationId(),
      type: 'tier_downgrade',
      title: 'Tier Adjusted',
      description: `Your tier has been adjusted to ${tierName} for the new month.`,
      dismissed: false,
      createdAt: new Date().toISOString(),
    });
  }

  async checkMilestones(playerId: string, oldLifetime: number, newLifetime: number) {
    for (const milestone of MILESTONES) {
      if (oldLifetime < milestone && newLifetime >= milestone) {
        await this.dynamoService.addNotification({
          playerId,
          notificationId: makeNotificationId(),
          type: 'milestone',
          title: `Milestone: ${milestone.toLocaleString()} Points`,
          description: `You've earned ${milestone.toLocaleString()} lifetime points!`,
          dismissed: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  async getNotifications(playerId: string, unreadOnly = false) {
    return this.dynamoService.getNotifications(playerId, unreadOnly);
  }

  async dismiss(playerId: string, notificationId: string) {
    try {
      await this.dynamoService.dismissNotification(playerId, notificationId);
    } catch (error) {
      if (isConditionalCheckFailed(error)) {
        throw new NotFoundException('Notification not found');
      }

      throw error;
    }
  }

  async getUnreadCount(playerId: string) {
    const items = await this.dynamoService.getNotifications(playerId, true);
    return items.length;
  }
}
