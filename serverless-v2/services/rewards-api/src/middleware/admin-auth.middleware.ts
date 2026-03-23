import {
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

interface AdminRequest extends Request {
  adminId?: string;
}

@Injectable()
export class AdminAuthMiddleware implements NestMiddleware {
  use(request: AdminRequest, response: Response, next: NextFunction) {
    const adminId = request.headers['x-admin-id'];

    if (typeof adminId !== 'string' || !adminId.trim()) {
      response.status(401).json({
        error: 'Unauthorized',
        message: 'X-Admin-Id header is required',
      });
      return;
    }

    request.adminId = adminId.trim();
    next();
  }
}
