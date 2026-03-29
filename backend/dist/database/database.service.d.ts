import { OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryResult, QueryResultRow } from 'pg';
export declare class DatabaseService implements OnModuleDestroy {
    private readonly configService;
    private readonly pool;
    constructor(configService: ConfigService);
    query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
    onModuleDestroy(): Promise<void>;
}
