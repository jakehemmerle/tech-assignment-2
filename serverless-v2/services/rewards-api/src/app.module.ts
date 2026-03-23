import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';

import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { REWARDS_TABLES } from './config/rewards.config';
import { DynamoService } from './dynamo/dynamo.service';
import { HealthController } from './health/health.controller';
import { IdentityService } from './identity/identity.service';
import { LeaderboardController } from './leaderboard/leaderboard.controller';
import { LeaderboardService } from './leaderboard/leaderboard.service';
import { AdminAuthMiddleware } from './middleware/admin-auth.middleware';
import { PlayerAuthMiddleware } from './middleware/player-auth.middleware';
import { MysqlService } from './mysql/mysql.service';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { PlayerController } from './player/player.controller';
import { PlayerService } from './player/player.service';
import { PointsController } from './points/points.controller';
import { PointsService } from './points/points.service';
import { RewardsStateService } from './reconciliation/rewards-state.service';

@Module({
  controllers: [
    AdminController,
    HealthController,
    LeaderboardController,
    NotificationsController,
    PlayerController,
    PointsController,
  ],
  providers: [
    { provide: 'REWARDS_TABLES', useValue: REWARDS_TABLES },
    AdminService,
    DynamoService,
    IdentityService,
    LeaderboardService,
    MysqlService,
    NotificationsService,
    PlayerService,
    PointsService,
    RewardsStateService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PlayerAuthMiddleware).forRoutes(
      LeaderboardController,
      NotificationsController,
      PlayerController
    );

    consumer.apply(AdminAuthMiddleware).forRoutes(PointsController, AdminController);
  }
}
