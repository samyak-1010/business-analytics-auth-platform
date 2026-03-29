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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const store_auth_guard_1 = require("../auth/store-auth.guard");
const store_id_decorator_1 = require("../auth/store-id.decorator");
const recent_activity_query_dto_1 = require("./dto/recent-activity-query.dto");
const top_products_query_dto_1 = require("./dto/top-products-query.dto");
const analytics_service_1 = require("./analytics.service");
let AnalyticsController = class AnalyticsController {
    analyticsService;
    constructor(analyticsService) {
        this.analyticsService = analyticsService;
    }
    getOverview(storeId, days) {
        const parsed = days ? parseInt(days, 10) : undefined;
        const daysNum = parsed && !isNaN(parsed) && parsed > 0 ? parsed : undefined;
        return this.analyticsService.getOverview(storeId, daysNum);
    }
    getTopProducts(storeId, query) {
        return this.analyticsService.getTopProducts(storeId, query.days);
    }
    getRecentActivity(storeId, query) {
        return this.analyticsService.getRecentActivity(storeId, query.limit);
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, common_1.Get)('overview'),
    __param(0, (0, store_id_decorator_1.StoreId)()),
    __param(1, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getOverview", null);
__decorate([
    (0, common_1.Get)('top-products'),
    __param(0, (0, store_id_decorator_1.StoreId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, top_products_query_dto_1.TopProductsQueryDto]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getTopProducts", null);
__decorate([
    (0, common_1.Get)('recent-activity'),
    __param(0, (0, store_id_decorator_1.StoreId)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, recent_activity_query_dto_1.RecentActivityQueryDto]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getRecentActivity", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, common_1.Controller)('analytics'),
    (0, common_1.UseGuards)(store_auth_guard_1.StoreAuthGuard),
    __metadata("design:paramtypes", [analytics_service_1.AnalyticsService])
], AnalyticsController);
//# sourceMappingURL=analytics.controller.js.map