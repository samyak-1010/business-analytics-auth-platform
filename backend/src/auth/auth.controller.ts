import { Body, Controller, Post } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  @Post('login')
  login(@Body() body: LoginDto) {
    return {
      accessToken: body.storeId,
      storeId: body.storeId,
      tokenType: 'Bearer',
      expiresIn: 60 * 60,
    };
  }
}
