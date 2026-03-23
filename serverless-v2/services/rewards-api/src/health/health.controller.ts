import { Controller, Get } from '@nestjs/common';

@Controller('api/v1/health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      service: 'rewards-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
