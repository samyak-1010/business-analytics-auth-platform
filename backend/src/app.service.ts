import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      service: 'amboras-analytics-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
