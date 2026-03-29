import { RecentActivityQueryDto } from './dto/recent-activity-query.dto';
import { TopProductsQueryDto } from './dto/top-products-query.dto';
import { AnalyticsService } from './analytics.service';
export declare class AnalyticsController {
    private readonly analyticsService;
    constructor(analyticsService: AnalyticsService);
    getOverview(storeId: string, days?: string): Promise<{
        revenue: {
            today: number;
            week: number;
            month: number;
        };
        eventsByType: Record<"page_view" | "add_to_cart" | "remove_from_cart" | "checkout_started" | "purchase", number>;
        conversionRate: number;
        totals: {
            purchases: number;
            pageViews: number;
        };
    }>;
    getTopProducts(storeId: string, query: TopProductsQueryDto): Promise<{
        windowDays: number;
        products: {
            productId: string;
            revenue: number;
            purchaseCount: number;
        }[];
    }>;
    getRecentActivity(storeId: string, query: RecentActivityQueryDto): Promise<{
        events: {
            eventId: string;
            storeId: string;
            eventType: "page_view" | "add_to_cart" | "remove_from_cart" | "checkout_started" | "purchase";
            timestamp: string;
            data: Record<string, unknown>;
        }[];
    }>;
}
