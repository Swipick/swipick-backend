import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiRateLimitService } from './api-rate-limit.service';

@Module({
  imports: [ConfigModule],
  providers: [ApiRateLimitService],
  exports: [ApiRateLimitService],
})
export class ApiRateLimitModule {}
