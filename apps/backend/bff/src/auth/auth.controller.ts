import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { VerifyTokenDto } from '@swipick/common';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('verify-token')
  async verifyToken(@Body() verifyTokenDto: VerifyTokenDto) {
    try {
      const user = await this.authService.verifyToken(verifyTokenDto.token);
      return {
        success: true,
        user,
      };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  @Post('verify-header')
  async verifyFromHeader(@Headers('authorization') authorization: string) {
    if (!authorization) {
      throw new UnauthorizedException('Authorization header required');
    }

    const token = authorization.replace('Bearer ', '');

    try {
      const user = await this.authService.verifyToken(token);
      return {
        success: true,
        user,
      };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
