import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

interface StoreRequest extends Request {
  storeId?: string;
}

/**
 * Multi-tenant authentication guard.
 *
 * Security model: Bearer token must exactly match the x-store-id header.
 * This is a demo-grade guard — in production, we'd verify a signed JWT and
 * extract the store claim from the token payload.
 *
 * Validation steps:
 * 1. x-store-id header present and non-empty
 * 2. storeId matches format `store_<alphanumeric>` (regex whitelist, not blacklist)
 * 3. Authorization header present with Bearer scheme
 * 4. Token matches storeId (tenant isolation)
 *
 * Distinct error messages help developers debug auth issues during integration.
 */
@Injectable()
export class StoreAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<StoreRequest>();
    const storeIdHeader = request.headers['x-store-id'];

    if (
      typeof storeIdHeader !== 'string' ||
      storeIdHeader.trim().length === 0
    ) {
      throw new BadRequestException('x-store-id header is required');
    }

    const storeId = storeIdHeader.trim();
    if (!/^store_[a-zA-Z0-9_-]+$/.test(storeId)) {
      throw new BadRequestException('x-store-id format is invalid');
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Authorization token format must be Bearer <token>',
      );
    }

    if (token !== storeId) {
      throw new UnauthorizedException('Token does not match tenant context');
    }

    request.storeId = storeId;
    return true;
  }
}
