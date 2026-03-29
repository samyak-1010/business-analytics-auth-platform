import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { UserAuthController } from './user-auth.controller';

@Module({
  controllers: [AuthController, UserAuthController],
})
export class AuthModule {}
