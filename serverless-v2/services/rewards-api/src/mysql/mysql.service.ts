import { Injectable, OnModuleDestroy } from '@nestjs/common';
import mysql, { Pool, RowDataPacket } from 'mysql2/promise';

import { MySqlPlayerIdentity } from '../config/rewards.types';

interface IdentityRow extends RowDataPacket, MySqlPlayerIdentity {}

@Injectable()
export class MysqlService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.MYSQL_HOST ?? '127.0.0.1',
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER ?? 'hijack',
      password: process.env.MYSQL_PASSWORD ?? 'hijack_dev',
      database: process.env.MYSQL_DATABASE ?? 'hijack_poker',
      connectionLimit: 5,
    });
  }

  async findPlayerIdentity(playerId: string) {
    const [rows] = await this.pool.query<IdentityRow[]>(
      'SELECT guid, username, email FROM players WHERE guid = ? LIMIT 1',
      [playerId]
    );

    return rows[0] ?? null;
  }

  async ping() {
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
