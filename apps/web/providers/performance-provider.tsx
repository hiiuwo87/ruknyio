'use client';

/**
 * 📊 Performance Provider - Initializes performance monitoring
 */

import { useEffect } from 'react';
import { type ReactNode } from 'react';
import { initPerformanceTracker, initWebVitals } from '@/lib/performance';
import type { PerformanceConfig } from '@/lib/performance/types';

interface PerformanceProviderProps {
  children: ReactNode;
  config?: Partial<PerformanceConfig>;
}

const defaultConfig: PerformanceConfig = {
  enabled: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE === 'true',
  sampleRate: 1, // Track 100% of sessions (can be reduced for high traffic)
  logToConsole: process.env.NODE_ENV === 'development',
  trackApiRequests: true,
  trackPageLoads: true,
  trackWebVitals: true,
  // apiEndpoint: '/api/v1/analytics/performance', // Uncomment to send metrics to backend
};

export function PerformanceProvider({ children, config }: PerformanceProviderProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const finalConfig = { ...defaultConfig, ...config };

    // Initialize performance tracker
    initPerformanceTracker(finalConfig);

    // Initialize Web Vitals tracking
    if (finalConfig.trackWebVitals) {
      initWebVitals();
    }

    // Track initial page load
    if (finalConfig.trackPageLoads) {
      import('@/lib/performance').then(({ trackPageLoad }) => {
        trackPageLoad(window.location.pathname);
      });
    }

    // Track page loads on navigation (Next.js App Router)
    const handleRouteChange = () => {
      if (finalConfig.trackPageLoads) {
        import('@/lib/performance').then(({ trackPageLoad }) => {
          trackPageLoad(window.location.pathname);
        });
      }
    };

    // Listen for Next.js route changes
    window.addEventListener('popstate', handleRouteChange);

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [config]);

  return <>{children}</>;
}
