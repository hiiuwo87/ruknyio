/**
 * 📊 Performance Monitoring Types
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  id: string;
  navigationType?: string;
}

export interface CoreWebVitals {
  cls?: PerformanceMetric; // Cumulative Layout Shift
  fcp?: PerformanceMetric; // First Contentful Paint
  fid?: PerformanceMetric; // First Input Delay
  lcp?: PerformanceMetric; // Largest Contentful Paint
  ttfb?: PerformanceMetric; // Time to First Byte
  inp?: PerformanceMetric; // Interaction to Next Paint
}

export interface ApiPerformanceMetric {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

export interface PagePerformanceMetric {
  page: string;
  loadTime: number;
  domContentLoaded: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
  timestamp: number;
}

export type PerformanceEvent = 
  | { type: 'web-vital'; metric: PerformanceMetric }
  | { type: 'api-request'; metric: ApiPerformanceMetric }
  | { type: 'page-load'; metric: PagePerformanceMetric };

export interface PerformanceConfig {
  enabled: boolean;
  sampleRate: number; // 0-1, percentage of sessions to track
  apiEndpoint?: string; // Optional endpoint to send metrics to
  logToConsole?: boolean;
  trackApiRequests?: boolean;
  trackPageLoads?: boolean;
  trackWebVitals?: boolean;
}
