import { Injectable } from '@nestjs/common';

import { MysqlService } from '../mysql/mysql.service';

@Injectable()
export class IdentityService {
  constructor(private readonly mysqlService: MysqlService) {}

  async findPlayerIdentity(playerId: string) {
    return this.mysqlService.findPlayerIdentity(playerId);
  }

  async resolveDisplayName(playerId: string) {
    const identity = await this.findPlayerIdentity(playerId);
    return identity?.username ?? playerId;
  }
}
