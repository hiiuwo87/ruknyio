/**
 * 📊 Performance Monitoring Utilities
 */

import type { PerformanceMetric, PerformanceConfig } from './types';

/**
 * Get performance rating based on metric thresholds
 */
export function getPerformanceRating(
  value: number,
  thresholds: { good: number; poor: number }
): 'good' | 'needs-improvement' | 'poor' {
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Core Web Vitals thresholds (in milliseconds or score)
 */
export const WEB_VITALS_THRESHOLDS = {
  cls: { good: 0.1, poor: 0.25 }, // Cumulative Layout Shift (score)
  fcp: { good: 1800, poor: 3000 }, // First Contentful Paint (ms)
  fid: { good: 100, poor: 300 }, // First Input Delay (ms)
  lcp: { good: 2500, poor: 4000 }, // Largest Contentful Paint (ms)
  ttfb: { good: 800, poor: 1800 }, // Time to First Byte (ms)
  inp: { good: 200, poor: 500 }, // Interaction to Next Paint (ms)
} as const;

/**
 * Format performance metric for logging
 */
export function formatMetric(metric: PerformanceMetric): string {
  const ratingEmoji = {
    good: '✅',
    'needs-improvement': '⚠️',
    poor: '❌',
  };

  return `${ratingEmoji[metric.rating]} ${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`;
}

/**
 * Check if performance monitoring should be enabled
 */
export function shouldTrackPerformance(config: PerformanceConfig): boolean {
  if (!config.enabled) return false;
  
  // Sample rate check (only track X% of sessions)
  if (config.sampleRate < 1) {
    return Math.random() < config.sampleRate;
  }
  
  return true;
}

/**
 * Get current page path
 */
export function getCurrentPage(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname;
}

/**
 * Get user agent info
 */
export function getUserAgentInfo() {
  if (typeof window === 'undefined') return null;
  
  const ua = navigator.userAgent;
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  return {
    userAgent: ua,
    connectionType: connection?.effectiveType || 'unknown',
    connectionDownlink: connection?.downlink || null,
    connectionRtt: connection?.rtt || null,
  };
}

/**
 * Measure time since page load
 */
export function getTimeSinceLoad(): number {
  if (typeof window === 'undefined' || !performance.timing) return 0;
  return performance.now();
}

/**
 * Get navigation timing
 */
export function getNavigationTiming() {
  if (typeof window === 'undefined' || !performance.getEntriesByType) return null;
  
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (!navigation) return null;
  
  return {
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
    domInteractive: navigation.domInteractive - navigation.fetchStart,
    dns: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcp: navigation.connectEnd - navigation.connectStart,
    request: navigation.responseStart - navigation.requestStart,
    response: navigation.responseEnd - navigation.responseStart,
    processing: navigation.domComplete - navigation.domInteractive,
  };
}
