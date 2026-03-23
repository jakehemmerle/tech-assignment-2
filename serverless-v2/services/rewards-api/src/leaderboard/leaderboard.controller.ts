import {
  Controller,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { LeaderboardService } from './leaderboard.service';

interface PlayerRequest extends Request {
  playerId: string;
}

@Controller('api/v1/leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  getLeaderboard(@Req() request: PlayerRequest, @Query() paginationQuery: PaginationQueryDto) {
    return this.leaderboardService.getPlayerLeaderboard(
      request.playerId,
      paginationQuery.limit ?? 10
    );
  }
}
