import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * Analytics Service
 *
 * Design decision: All aggregations run at query time via indexed SQL.
 * Rationale: Avoids pre-aggregation infrastructure (rollup tables, cron jobs)
 * while keeping logic transparent and easy to audit. At current scale (~25k events),
 * indexed queries execute in <50ms. For 100M+ events, we'd introduce hourly/daily
 * materialized views.
 *
 * Every query is scoped by store_id (multi-tenant isolation) and uses parameterized
 * queries ($1, $2) to prevent SQL injection.
 */

type EventType =
  | 'page_view'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'checkout_started'
  | 'purchase';

const EVENT_TYPES: EventType[] = [
  'page_view',
  'add_to_cart',
  'remove_from_cart',
  'checkout_started',
  'purchase',
];

interface OverviewRow {
  revenue_today: string;
  revenue_week: string;
  revenue_month: string;
  purchases: string;
  page_views: string;
}

interface CountRow {
  event_type: EventType;
  total: string;
}

interface TopProductRow {
  product_id: string;
  revenue: string;
  purchase_count: string;
}

interface RecentEventRow {
  event_id: string;
  store_id: string;
  event_type: EventType;
  timestamp: string;
  data: Record<string, unknown>;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Returns revenue (today/week/month), event type counts, and conversion rate.
   *
   * Design decisions:
   * - Uses conditional SUM via CASE for multi-period revenue in a single table scan
   * - COALESCE guards against NULL when no matching rows exist (empty store)
   * - COUNT(*) FILTER is more efficient than separate COUNT queries per event_type
   * - Conversion rate divides purchases by page views with zero-division protection
   */
  async getOverview(storeId: string, days?: number) {
    let overviewResult, countResult;
    if (days && days > 0) {
      // Windowed query
      [overviewResult, countResult] = await Promise.all([
        this.databaseService.query<OverviewRow>(
          `
            SELECT
              COALESCE(SUM(CASE WHEN event_type = 'purchase' THEN (data->>'amount')::numeric ELSE 0 END), 0)::text AS revenue_today,
              COALESCE(SUM(CASE WHEN event_type = 'purchase' THEN (data->>'amount')::numeric ELSE 0 END), 0)::text AS revenue_week,
              COALESCE(SUM(CASE WHEN event_type = 'purchase' THEN (data->>'amount')::numeric ELSE 0 END), 0)::text AS revenue_month,
              COUNT(*) FILTER (WHERE event_type = 'purchase')::text AS purchases,
              COUNT(*) FILTER (WHERE event_type = 'page_view')::text AS page_views
            FROM events
            WHERE store_id = $1
              AND timestamp >= NOW() - ($2 * INTERVAL '1 day')
          `,
          [storeId, days],
        ),
        this.databaseService.query<CountRow>(
          `
            SELECT event_type, COUNT(*)::text AS total
            FROM events
            WHERE store_id = $1
              AND timestamp >= NOW() - ($2 * INTERVAL '1 day')
            GROUP BY event_type
          `,
          [storeId, days],
        ),
      ]);
    } else {
      // Default: revenue for today/week/month using date_trunc for timezone-aware boundaries
      [overviewResult, countResult] = await Promise.all([
        this.databaseService.query<OverviewRow>(
          `
            SELECT
              COALESCE(SUM(CASE WHEN event_type = 'purchase' AND timestamp >= date_trunc('day', NOW()) THEN (data->>'amount')::numeric ELSE 0 END), 0)::text AS revenue_today,
              COALESCE(SUM(CASE WHEN event_type = 'purchase' AND timestamp >= date_trunc('week', NOW()) THEN (data->>'amount')::numeric ELSE 0 END), 0)::text AS revenue_week,
              COALESCE(SUM(CASE WHEN event_type = 'purchase' AND timestamp >= date_trunc('month', NOW()) THEN (data->>'amount')::numeric ELSE 0 END), 0)::text AS revenue_month,
              COUNT(*) FILTER (WHERE event_type = 'purchase')::text AS purchases,
              COUNT(*) FILTER (WHERE event_type = 'page_view')::text AS page_views
            FROM events
            WHERE store_id = $1
          `,
          [storeId],
        ),
        this.databaseService.query<CountRow>(
          `
            SELECT event_type, COUNT(*)::text AS total
            FROM events
            WHERE store_id = $1
            GROUP BY event_type
          `,
          [storeId],
        ),
      ]);
    }

    const overview = overviewResult.rows[0];

    // Initialize all event types to 0 — ensures the frontend always gets a complete
    // set of keys even if some event types have zero occurrences in the time window
    const countsByType = EVENT_TYPES.reduce<Record<EventType, number>>(
      (acc, type) => {
        acc[type] = 0;
        return acc;
      },
      {} as Record<EventType, number>,
    );

    for (const row of countResult.rows) {
      countsByType[row.event_type] = Number(row.total);
    }

    const purchases = Number(overview?.purchases ?? '0');
    const pageViews = Number(overview?.page_views ?? '0');

    return {
      revenue: {
        today: Number(overview?.revenue_today ?? '0'),
        week: Number(overview?.revenue_week ?? '0'),
        month: Number(overview?.revenue_month ?? '0'),
      },
      eventsByType: countsByType,
      // Edge case: division by zero if no page views recorded yet
      conversionRate:
        pageViews > 0 ? Number(((purchases / pageViews) * 100).toFixed(2)) : 0,
      totals: {
        purchases,
        pageViews,
      },
    };
  }

  /**
   * Returns top 10 products ranked by total revenue in a sliding time window.
   *
   * Uses the partial index `idx_events_purchase_product` (on product_id WHERE
   * event_type = 'purchase') for efficient filtering without scanning non-purchase events.
   */
  async getTopProducts(storeId: string, days = 30) {
    const result = await this.databaseService.query<TopProductRow>(
      `
        SELECT
          data->>'product_id' AS product_id,
          COALESCE(SUM((data->>'amount')::numeric), 0)::text AS revenue,
          COUNT(*)::text AS purchase_count
        FROM events
        WHERE store_id = $1
          AND event_type = 'purchase'
          AND timestamp >= NOW() - ($2 * INTERVAL '1 day')
        GROUP BY data->>'product_id'
        ORDER BY COALESCE(SUM((data->>'amount')::numeric), 0) DESC
        LIMIT 10
      `,
      [storeId, days],
    );

    return {
      windowDays: days,
      products: result.rows.map((row) => ({
        productId: row.product_id,
        revenue: Number(row.revenue),
        purchaseCount: Number(row.purchase_count),
      })),
    };
  }

  /**
   * Returns the most recent events for a store, ordered by timestamp DESC.
   * Uses the composite index (store_id, timestamp DESC) for index-ordered retrieval.
   *
   * The limit is capped at 50 by the DTO validator to prevent excessive payload sizes.
   */
  async getRecentActivity(storeId: string, limit = 20) {
    const result = await this.databaseService.query<RecentEventRow>(
      `
        SELECT event_id, store_id, event_type, timestamp, data
        FROM events
        WHERE store_id = $1
        ORDER BY timestamp DESC
        LIMIT $2
      `,
      [storeId, limit],
    );

    return {
      events: result.rows.map((row) => ({
        eventId: row.event_id,
        storeId: row.store_id,
        eventType: row.event_type,
        timestamp: row.timestamp,
        data: row.data,
      })),
    };
  }
}
