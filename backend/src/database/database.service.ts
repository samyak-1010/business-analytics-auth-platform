import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

/**
 * Global database connection pool.
 *
 * Design decisions:
 * - Uses `pg` Pool directly instead of an ORM (TypeORM/Prisma) for full control
 *   over SQL queries — essential for analytics aggregation performance
 * - Supports both DATABASE_URL (for cloud deployments) and individual env vars
 * - Configurable pool size (DB_POOL_MAX, default 20) to match expected concurrency
 * - Implements OnModuleDestroy to gracefully drain connections on shutdown
 * - Generic query<T> method provides type safety without ORM overhead
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    this.pool = databaseUrl
      ? new Pool({ connectionString: databaseUrl })
      : new Pool({
          host: this.configService.get<string>('DB_HOST', 'localhost'),
          port: Number(this.configService.get<string>('DB_PORT', '5432')),
          user: this.configService.get<string>('DB_USER', 'postgres'),
          password: this.configService.get<string>('DB_PASSWORD', 'postgres'),
          database: this.configService.get<string>('DB_NAME', 'amboras'),
          max: Number(this.configService.get<string>('DB_POOL_MAX', '20')),
        });
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
