import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { HealthController } from './health.controller';
import { MetricsService } from './metrics.service';

/**
 * 📊 Monitoring Module
 *
 * مراقبة صحة التطبيق والأداء:
 * - Health checks
 * - Prometheus metrics
 * - Performance tracking
 */
@Module({
  controllers: [HealthController],
  providers: [MonitoringService, MetricsService],
  exports: [MonitoringService, MetricsService],
})
export class MonitoringModule {}
