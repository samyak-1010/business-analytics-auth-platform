import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

interface StoreRequest extends Request {
  storeId?: string;
}

export const StoreId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<StoreRequest>();
    return request.storeId;
  },
);
