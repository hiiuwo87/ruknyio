/**
 * 📊 Performance Tracker - Core monitoring functionality
 */

import type {
  PerformanceMetric,
  CoreWebVitals,
  ApiPerformanceMetric,
  PagePerformanceMetric,
  PerformanceConfig,
  PerformanceEvent,
} from './types';
import {
  getPerformanceRating,
  WEB_VITALS_THRESHOLDS,
  formatMetric,
  shouldTrackPerformance,
  getCurrentPage,
  getUserAgentInfo,
  getNavigationTiming,
} from './utils';

class PerformanceTracker {
  private config: PerformanceConfig;
  private metrics: PerformanceEvent[] = [];
  private webVitals: Partial<CoreWebVitals> = {};

  constructor(config: PerformanceConfig) {
    this.config = config;
  }

  /**
   * Track a Web Vital metric
   */
  trackWebVital(metric: PerformanceMetric): void {
    if (!shouldTrackPerformance(this.config) || !this.config.trackWebVitals) {
      return;
    }

    this.webVitals[metric.name.toLowerCase() as keyof CoreWebVitals] = metric;

    const event: PerformanceEvent = {
      type: 'web-vital',
      metric,
    };

    this.metrics.push(event);
    this.logMetric(metric);
    this.sendMetric(event);
  }

  /**
   * Track an API request performance
   */
  trackApiRequest(metric: ApiPerformanceMetric): void {
    if (!shouldTrackPerformance(this.config) || !this.config.trackApiRequests) {
      return;
    }

    const event: PerformanceEvent = {
      type: 'api-request',
      metric,
    };

    this.metrics.push(event);
    this.sendMetric(event);
  }

  /**
   * Track page load performance
   */
  trackPageLoad(metric: PagePerformanceMetric): void {
    if (!shouldTrackPerformance(this.config) || !this.config.trackPageLoads) {
      return;
    }

    const event: PerformanceEvent = {
      type: 'page-load',
      metric,
    };

    this.metrics.push(event);
    this.sendMetric(event);
  }

  /**
   * Get all collected metrics
   */
  getMetrics(): PerformanceEvent[] {
    return [...this.metrics];
  }

  /**
   * Get Core Web Vitals
   */
  getWebVitals(): Partial<CoreWebVitals> {
    return { ...this.webVitals };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.webVitals = {};
  }

  /**
   * Log metric to console (if enabled)
   */
  private logMetric(metric: PerformanceMetric): void {
    if (this.config.logToConsole) {
      // Performance metric tracked
    }
  }

  /**
   * Send metric to backend (if endpoint configured)
   */
  private async sendMetric(event: PerformanceEvent): Promise<void> {
    if (!this.config.apiEndpoint) return;

    try {
      // Use sendBeacon for better reliability (doesn't block page unload)
      if (navigator.sendBeacon) {
        const data = JSON.stringify({
          ...event,
          page: getCurrentPage(),
          userAgent: getUserAgentInfo(),
          timestamp: Date.now(),
        });

        navigator.sendBeacon(this.config.apiEndpoint, data);
      } else {
        // Fallback to fetch
        await fetch(this.config.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...event,
            page: getCurrentPage(),
            userAgent: getUserAgentInfo(),
            timestamp: Date.now(),
          }),
          keepalive: true, // Keep request alive even if page unloads
        });
      }
    } catch (error) {
      // Silently fail - don't break the app if metrics fail
      if (this.config.logToConsole) {
        // Failed to send metric
      }
    }
  }
}

// Create singleton instance
let trackerInstance: PerformanceTracker | null = null;

/**
 * Initialize performance tracker
 */
export function initPerformanceTracker(config: PerformanceConfig): PerformanceTracker {
  if (trackerInstance) {
    return trackerInstance;
  }

  trackerInstance = new PerformanceTracker(config);
  return trackerInstance;
}

/**
 * Get performance tracker instance
 */
export function getPerformanceTracker(): PerformanceTracker | null {
  return trackerInstance;
}

/**
 * Track Web Vital with automatic rating
 */
export function trackWebVital(
  name: string,
  value: number,
  id: string,
  delta?: number,
  navigationType?: string
): void {
  const tracker = getPerformanceTracker();
  if (!tracker) return;

  const thresholds = WEB_VITALS_THRESHOLDS[name.toLowerCase() as keyof typeof WEB_VITALS_THRESHOLDS];
  if (!thresholds) {
    // Unknown Web Vital
    return;
  }

  const rating = getPerformanceRating(value, thresholds);

  tracker.trackWebVital({
    name,
    value,
    rating,
    delta,
    id,
    navigationType,
  });
}

/**
 * Track API request performance
 */
export function trackApiRequest(
  endpoint: string,
  method: string,
  duration: number,
  status: number,
  success: boolean,
  error?: string
): void {
  const tracker = getPerformanceTracker();
  if (!tracker) return;

  tracker.trackApiRequest({
    endpoint,
    method,
    duration,
    status,
    timestamp: Date.now(),
    success,
    error,
  });
}

/**
 * Track page load performance
 */
export function trackPageLoad(page: string): void {
  const tracker = getPerformanceTracker();
  if (!tracker) return;

  const timing = getNavigationTiming();
  if (!timing) return;

  const paintEntries = performance.getEntriesByType('paint') as PerformancePaintTiming[];
  const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
  const fp = paintEntries.find(entry => entry.name === 'first-paint');

  tracker.trackPageLoad({
    page,
    loadTime: timing.loadComplete,
    domContentLoaded: timing.domContentLoaded,
    firstPaint: fp ? fp.startTime : undefined,
    firstContentfulPaint: fcp ? fcp.startTime : undefined,
    timestamp: Date.now(),
  });
}
