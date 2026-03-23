import {
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

interface PlayerRequest extends Request {
  playerId?: string;
}

@Injectable()
export class PlayerAuthMiddleware implements NestMiddleware {
  use(request: PlayerRequest, response: Response, next: NextFunction) {
    const playerId = request.headers['x-player-id'];

    if (typeof playerId !== 'string' || !playerId.trim()) {
      response.status(401).json({
        error: 'Unauthorized',
        message: 'X-Player-Id header is required',
      });
      return;
    }

    request.playerId = playerId.trim();
    next();
  }
}
