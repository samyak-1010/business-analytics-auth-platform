import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StoreAuthGuard } from '../auth/store-auth.guard';
import { StoreId } from '../auth/store-id.decorator';
import { RecentActivityQueryDto } from './dto/recent-activity-query.dto';
import { TopProductsQueryDto } from './dto/top-products-query.dto';
import { AnalyticsService } from './analytics.service';

/**
 * Analytics endpoints — all protected by StoreAuthGuard.
 * Every request must include Authorization: Bearer <storeId> and x-store-id headers.
 * Query params are validated via class-validator DTOs (whitelist + transform).
 */
@Controller('analytics')
@UseGuards(StoreAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(
    @StoreId() storeId: string,
    @Query('days') days?: string,
  ) {
    // Parse days as integer if present; guard against NaN from malformed input
    const parsed = days ? parseInt(days, 10) : undefined;
    const daysNum = parsed && !isNaN(parsed) && parsed > 0 ? parsed : undefined;
    return this.analyticsService.getOverview(storeId, daysNum);
  }

  @Get('top-products')
  getTopProducts(
    @StoreId() storeId: string,
    @Query() query: TopProductsQueryDto,
  ) {
    return this.analyticsService.getTopProducts(storeId, query.days);
  }

  @Get('recent-activity')
  getRecentActivity(
    @StoreId() storeId: string,
    @Query() query: RecentActivityQueryDto,
  ) {
    return this.analyticsService.getRecentActivity(storeId, query.limit);
  }
}
