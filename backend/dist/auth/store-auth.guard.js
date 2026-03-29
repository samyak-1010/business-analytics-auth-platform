"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreAuthGuard = void 0;
const common_1 = require("@nestjs/common");
let StoreAuthGuard = class StoreAuthGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const storeIdHeader = request.headers['x-store-id'];
        if (typeof storeIdHeader !== 'string' ||
            storeIdHeader.trim().length === 0) {
            throw new common_1.BadRequestException('x-store-id header is required');
        }
        const storeId = storeIdHeader.trim();
        if (!/^store_[a-zA-Z0-9_-]+$/.test(storeId)) {
            throw new common_1.BadRequestException('x-store-id format is invalid');
        }
        const authorization = request.headers.authorization;
        if (!authorization) {
            throw new common_1.UnauthorizedException('Authorization header is required');
        }
        const [scheme, token] = authorization.split(' ');
        if (scheme !== 'Bearer' || !token) {
            throw new common_1.UnauthorizedException('Authorization token format must be Bearer <token>');
        }
        if (token !== storeId) {
            throw new common_1.UnauthorizedException('Token does not match tenant context');
        }
        request.storeId = storeId;
        return true;
    }
};
exports.StoreAuthGuard = StoreAuthGuard;
exports.StoreAuthGuard = StoreAuthGuard = __decorate([
    (0, common_1.Injectable)()
], StoreAuthGuard);
//# sourceMappingURL=store-auth.guard.js.map