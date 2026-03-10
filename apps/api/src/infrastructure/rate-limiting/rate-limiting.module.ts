import { Module } from '@nestjs/common';
import { RateLimitingService } from './rate-limiting.service';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitingController } from './rate-limiting.controller';

/**
 * 🚦 Rate Limiting Module
 *
 * تحديد معدل الطلبات المتقدم:
 * - Per-user limiting
 * - Per-IP limiting
 * - Per-endpoint limiting
 * - Sliding window algorithm
 */
@Module({
  controllers: [RateLimitingController],
  providers: [RateLimitingService, RateLimitGuard],
  exports: [RateLimitingService, RateLimitGuard],
})
export class RateLimitingModule {}
