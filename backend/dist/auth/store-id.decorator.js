"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreId = void 0;
const common_1 = require("@nestjs/common");
exports.StoreId = (0, common_1.createParamDecorator)((_, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.storeId;
});
//# sourceMappingURL=store-id.decorator.js.map