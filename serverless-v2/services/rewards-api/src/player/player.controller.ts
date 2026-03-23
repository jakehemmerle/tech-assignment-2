import {
  Controller,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PlayerService } from './player.service';

interface PlayerRequest extends Request {
  playerId: string;
}

@Controller('api/v1/player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Get('rewards')
  getRewards(@Req() request: PlayerRequest) {
    return this.playerService.getSummary(request.playerId);
  }

  @Get('rewards/history')
  getRewardsHistory(
    @Req() request: PlayerRequest,
    @Query() paginationQuery: PaginationQueryDto
  ) {
    return this.playerService.getHistory(
      request.playerId,
      paginationQuery.limit ?? 20,
      paginationQuery.offset ?? 0
    );
  }

  @Get('rewards/timeline')
  getRewardsTimeline(@Req() request: PlayerRequest) {
    return this.playerService.getTimeline(request.playerId);
  }
}
