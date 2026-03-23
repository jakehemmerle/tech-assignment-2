import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { NotificationsQueryDto } from '../common/dto/notifications-query.dto';
import { NotificationsService } from './notifications.service';

interface PlayerRequest extends Request {
  playerId: string;
}

@Controller('api/v1/player/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getNotifications(
    @Req() request: PlayerRequest,
    @Query() query: NotificationsQueryDto
  ) {
    const notifications = await this.notificationsService.getNotifications(
      request.playerId,
      query.unread ?? false
    );

    return {
      notifications: notifications.map((notification) => ({
        notificationId: notification.notificationId,
        type: notification.type,
        title: notification.title,
        description: notification.description,
        dismissed: notification.dismissed,
        createdAt: notification.createdAt,
        dismissedAt: notification.dismissedAt ?? null,
      })),
      total: notifications.length,
    };
  }

  @Patch(':id/dismiss')
  async dismissNotification(@Req() request: PlayerRequest, @Param('id') notificationId: string) {
    await this.notificationsService.dismiss(request.playerId, notificationId);
    return { success: true };
  }
}
