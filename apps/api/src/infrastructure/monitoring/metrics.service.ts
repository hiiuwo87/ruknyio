import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../../core/cache/redis.service';

/**
 * 📈 Metrics Service
 *
 * تجميع وتصدير المقاييس بصيغة Prometheus
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();

  constructor(private readonly redis: RedisService) {}

  onModuleInit() {
    this.logger.log('📈 Metrics service initialized');
  }

  // ==================== Counters ====================

  /**
   * زيادة عداد
   */
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * الحصول على قيمة عداد
   */
  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.buildKey(name, labels);
    return this.counters.get(key) || 0;
  }

  // ==================== Gauges ====================

  /**
   * تعيين قيمة gauge
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);
  }

  /**
   * الحصول على قيمة gauge
   */
  getGauge(name: string, labels?: Record<string, string>): number {
    const key = this.buildKey(name, labels);
    return this.gauges.get(key) || 0;
  }

  // ==================== Histograms ====================

  /**
   * تسجيل قيمة في histogram
   */
  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.buildKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    
    // الاحتفاظ بآخر 1000 قيمة فقط
    if (values.length > 1000) {
      values.shift();
    }
    
    this.histograms.set(key, values);
  }

  /**
   * الحصول على إحصائيات histogram
   */
  getHistogramStats(name: string, labels?: Record<string, string>): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const key = this.buildKey(name, labels);
    const values = this.histograms.get(key) || [];
    
    if (values.length === 0) {
      return { count: 0, sum: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
    };
  }

  // ==================== Common Metrics ====================

  /**
   * تسجيل طلب HTTP
   */
  recordHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
  ): void {
    // عداد الطلبات
    this.incrementCounter('http_requests_total', 1, {
      method,
      path: this.normalizePath(path),
      status: statusCode.toString(),
    });

    // مدة الطلب
    this.observeHistogram('http_request_duration_ms', duration, {
      method,
      path: this.normalizePath(path),
    });
  }

  /**
   * تسجيل خطأ
   */
  recordError(type: string, message?: string): void {
    this.incrementCounter('errors_total', 1, { type });
  }

  /**
   * تسجيل استخدام cache
   */
  recordCacheHit(hit: boolean): void {
    this.incrementCounter(hit ? 'cache_hits_total' : 'cache_misses_total');
  }

  /**
   * تسجيل استعلام قاعدة بيانات
   */
  recordDatabaseQuery(operation: string, duration: number): void {
    this.incrementCounter('db_queries_total', 1, { operation });
    this.observeHistogram('db_query_duration_ms', duration, { operation });
  }

  // ==================== Export ====================

  /**
   * تصدير المقاييس بصيغة Prometheus
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    // Counters
    for (const [key, value] of this.counters) {
      const { name, labels } = this.parseKey(key);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name}${this.formatLabels(labels)} ${value}`);
    }

    // Gauges
    for (const [key, value] of this.gauges) {
      const { name, labels } = this.parseKey(key);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name}${this.formatLabels(labels)} ${value}`);
    }

    // Histograms
    for (const [key, values] of this.histograms) {
      const { name, labels } = this.parseKey(key);
      const stats = this.getHistogramStats(name, labels);
      
      lines.push(`# TYPE ${name} histogram`);
      lines.push(`${name}_count${this.formatLabels(labels)} ${stats.count}`);
      lines.push(`${name}_sum${this.formatLabels(labels)} ${stats.sum}`);
      lines.push(`${name}_avg${this.formatLabels(labels)} ${stats.avg}`);
    }

    return lines.join('\n');
  }

  /**
   * تصدير المقاييس كـ JSON
   */
  exportJson(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, any>;
  } {
    const histogramStats: Record<string, any> = {};
    for (const [key] of this.histograms) {
      const { name, labels } = this.parseKey(key);
      histogramStats[key] = this.getHistogramStats(name, labels);
    }

    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: histogramStats,
    };
  }

  /**
   * إعادة تعيين جميع المقاييس
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.logger.log('All metrics reset');
  }

  // ==================== Helper Methods ====================

  private buildKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private parseKey(key: string): { name: string; labels: Record<string, string> } {
    const match = key.match(/^([^{]+)(?:\{(.+)\})?$/);
    if (!match) {
      return { name: key, labels: {} };
    }

    const name = match[1];
    const labels: Record<string, string> = {};

    if (match[2]) {
      match[2].split(',').forEach((pair) => {
        const [k, v] = pair.split('=');
        labels[k] = v.replace(/"/g, '');
      });
    }

    return { name, labels };
  }

  private formatLabels(labels: Record<string, string>): string {
    if (Object.keys(labels).length === 0) {
      return '';
    }
    const pairs = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `{${pairs}}`;
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private normalizePath(path: string): string {
    // استبدال IDs بـ :id
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }
}
