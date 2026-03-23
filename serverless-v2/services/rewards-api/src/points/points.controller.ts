import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { AwardPointsDto } from '../common/dto/award-points.dto';
import { PointsService } from './points.service';

interface AdminRequest extends Request {
  adminId: string;
}

@Controller('api/v1/points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Post('award')
  @HttpCode(200)
  awardPoints(@Body() payload: AwardPointsDto, @Req() request: AdminRequest) {
    return this.pointsService.awardPoints(payload, request.adminId);
  }
}
