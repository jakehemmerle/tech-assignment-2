import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { AdjustPointsDto } from '../common/dto/adjust-points.dto';
import { MonthlyResetDto } from '../common/dto/monthly-reset.dto';
import { TierOverrideDto } from '../common/dto/tier-override.dto';
import { AdminService } from './admin.service';

interface AdminRequest extends Request {
  adminId: string;
}

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('players/:playerId/rewards')
  getPlayerRewards(@Param('playerId') playerId: string) {
    return this.adminService.getPlayerRewards(playerId);
  }

  @Post('points/adjust')
  @HttpCode(200)
  adjustPoints(@Body() payload: AdjustPointsDto, @Req() request: AdminRequest) {
    return this.adminService.adjustPoints(payload, request.adminId);
  }

  @Get('leaderboard')
  getLeaderboard() {
    return this.adminService.getLeaderboard();
  }

  @Post('tier/override')
  @HttpCode(200)
  overrideTier(@Body() payload: TierOverrideDto) {
    return this.adminService.overrideTier(payload);
  }

  @Post('monthly-reset')
  @HttpCode(200)
  monthlyReset(@Body() payload: MonthlyResetDto) {
    return this.adminService.monthlyReset(payload);
  }
}
