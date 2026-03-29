import { DatabaseService } from '../database/database.service';
type EventType = 'page_view' | 'add_to_cart' | 'remove_from_cart' | 'checkout_started' | 'purchase';
export declare class AnalyticsService {
    private readonly databaseService;
    constructor(databaseService: DatabaseService);
    getOverview(storeId: string, days?: number): Promise<{
        revenue: {
            today: number;
            week: number;
            month: number;
        };
        eventsByType: Record<EventType, number>;
        conversionRate: number;
        totals: {
            purchases: number;
            pageViews: number;
        };
    }>;
    getTopProducts(storeId: string, days?: number): Promise<{
        windowDays: number;
        products: {
            productId: string;
            revenue: number;
            purchaseCount: number;
        }[];
    }>;
    getRecentActivity(storeId: string, limit?: number): Promise<{
        events: {
            eventId: string;
            storeId: string;
            eventType: EventType;
            timestamp: string;
            data: Record<string, unknown>;
        }[];
    }>;
}
export {};
