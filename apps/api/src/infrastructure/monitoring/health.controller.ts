import { Controller, Get } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from './metrics.service';

/**
 * 🏥 Health Controller
 *
 * نقاط نهاية للمراقبة والصحة
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * فحص سريع للـ load balancer
   */
  @Get()
  async quickCheck() {
    return this.monitoringService.quickCheck();
  }

  /**
   * فحص مفصل
   */
  @Get('detailed')
  async detailedCheck() {
    return this.monitoringService.getHealthStatus();
  }

  /**
   * فحص جاهزية التطبيق
   */
  @Get('ready')
  async readinessCheck() {
    const health = await this.monitoringService.getHealthStatus();
    
    if (health.status === 'unhealthy') {
      return { ready: false, reason: 'Critical services down' };
    }
    
    return { ready: true };
  }

  /**
   * فحص حياة التطبيق
   */
  @Get('live')
  async livenessCheck() {
    return { alive: true, uptime: process.uptime() };
  }

  /**
   * مقاييس Prometheus
   */
  @Get('metrics')
  async getMetrics() {
    return this.metricsService.exportPrometheus();
  }

  /**
   * مقاييس JSON
   */
  @Get('metrics/json')
  async getMetricsJson() {
    return this.metricsService.exportJson();
  }

  /**
   * إحصائيات قاعدة البيانات
   */
  @Get('database')
  async getDatabaseStats() {
    return this.monitoringService.getDatabaseStats();
  }
}
