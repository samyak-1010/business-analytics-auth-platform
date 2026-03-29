"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
const EVENT_TYPES = [
    'page_view',
    'add_to_cart',
    'remove_from_cart',
    'checkout_started',
    'purchase',
];
let AnalyticsService = class AnalyticsService {
    databaseService;
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async getOverview(storeId, days) {
        let overviewResult, countResult;
        if (days && days > 0) {
            [overviewResult, countResult] = await Promise.all([
                this.databaseService.query(`
            SELECT
              COALESCE(SUM(CASE WHEN event_type = 'purchase' THEN (data->>'amount')::numeric ELSE 0 END), 0)::text AS revenue_today,
              COALESCE(SUM(CASE WHEN event_type = 'purchase' THEN (data->>'amount')::numeric ELSE 0 END), 0)::text AS revenue_week,
              COALESCE(SUM(CASE WHEN event_type = 'purchase' THEN (data->>'amount')::numeric ELSE 0 END), 0)::text AS revenue_month,
              COUNT(*) FILTER (WHERE event_type = 'purchase')::text AS purchases,
              COUNT(*) FILTER (WHERE event_type = 'page_view')::text AS page_views
            FROM events
            WHERE store_id = $1
              AND timestamp >= NOW() - ($2 * INTERVAL '1 day')
          `, [storeId, days]),
                this.databaseService.query(`
            SELECT event_type, COUNT(*)::text AS total
            FROM events
            WHERE store_id = $1
              AND timestamp >= NOW() - ($2 * INTERVAL '1 day')
            GROUP BY event_type
          `, [storeId, days]),
            ]);
        }
        else {
            [overviewResult, countResult] = await Promise.all([
                this.databaseService.query(`
            SELECT
              COALESCE(SUM(CASE WHEN event_type = 'purchase' AND timestamp >= date_trunc('day', NOW()) THEN (data->>'amount')::numeric ELSE 0 END), 0)::text AS revenue_today,
              COALESCE(SUM(CASE WHEN event_type = 'purchase' AND timestamp >= date_trunc('week', NOW()) THEN (data->>'amount')::numeric ELSE 0 END), 0)::text AS revenue_week,
              COALESCE(SUM(CASE WHEN event_type = 'purchase' AND timestamp >= date_trunc('month', NOW()) THEN (data->>'amount')::numeric ELSE 0 END), 0)::text AS revenue_month,
              COUNT(*) FILTER (WHERE event_type = 'purchase')::text AS purchases,
              COUNT(*) FILTER (WHERE event_type = 'page_view')::text AS page_views
            FROM events
            WHERE store_id = $1
          `, [storeId]),
                this.databaseService.query(`
            SELECT event_type, COUNT(*)::text AS total
            FROM events
            WHERE store_id = $1
            GROUP BY event_type
          `, [storeId]),
            ]);
        }
        const overview = overviewResult.rows[0];
        const countsByType = EVENT_TYPES.reduce((acc, type) => {
            acc[type] = 0;
            return acc;
        }, {});
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
            conversionRate: pageViews > 0 ? Number(((purchases / pageViews) * 100).toFixed(2)) : 0,
            totals: {
                purchases,
                pageViews,
            },
        };
    }
    async getTopProducts(storeId, days = 30) {
        const result = await this.databaseService.query(`
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
      `, [storeId, days]);
        return {
            windowDays: days,
            products: result.rows.map((row) => ({
                productId: row.product_id,
                revenue: Number(row.revenue),
                purchaseCount: Number(row.purchase_count),
            })),
        };
    }
    async getRecentActivity(storeId, limit = 20) {
        const result = await this.databaseService.query(`
        SELECT event_id, store_id, event_type, timestamp, data
        FROM events
        WHERE store_id = $1
        ORDER BY timestamp DESC
        LIMIT $2
      `, [storeId, limit]);
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
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map