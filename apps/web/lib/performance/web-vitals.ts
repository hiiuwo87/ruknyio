/**
 * 📊 Core Web Vitals Tracking
 * 
 * Tracks Google Core Web Vitals:
 * - LCP (Largest Contentful Paint)
 * - FID (First Input Delay) / INP (Interaction to Next Paint)
 * - CLS (Cumulative Layout Shift)
 * - FCP (First Contentful Paint)
 * - TTFB (Time to First Byte)
 */

'use client';

import { trackWebVital } from './tracker';

/**
 * Initialize Core Web Vitals tracking
 */
export function initWebVitals(): void {
  if (typeof window === 'undefined') return;

  // LCP - Largest Contentful Paint
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        
        trackWebVital(
          'LCP',
          lastEntry.renderTime || lastEntry.loadTime,
          lastEntry.id || 'lcp',
          undefined,
          lastEntry.navigationType
        );
      });

      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      // Browser doesn't support LCP
    }

    // FCP - First Contentful Paint
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries[0] as PerformancePaintTiming;
        
        trackWebVital(
          'FCP',
          fcpEntry.startTime,
          'fcp',
          undefined,
          'navigation'
        );
      });

      fcpObserver.observe({ entryTypes: ['paint'] });
    } catch (e) {
      // Browser doesn't support FCP
    }

    // CLS - Cumulative Layout Shift
    try {
      let clsValue = 0;
      let clsEntries: any[] = [];

      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Only count layout shifts without recent user input
          if (!(entry as any).hadRecentInput) {
            clsEntries.push(entry);
            clsValue += (entry as any).value;
          }
        }
      });

      clsObserver.observe({ entryTypes: ['layout-shift'] });

      // Report CLS when page is hidden or unloaded
      const reportCLS = () => {
        if (clsValue > 0) {
          trackWebVital('CLS', clsValue, 'cls');
        }
      };

      document.addEventListener('visibilitychange', reportCLS);
      window.addEventListener('beforeunload', reportCLS);
    } catch (e) {
      // Browser doesn't support CLS
    }

    // FID - First Input Delay (legacy, replaced by INP in newer browsers)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const fidEntry = entry as any;
          trackWebVital(
            'FID',
            fidEntry.processingStart - fidEntry.startTime,
            fidEntry.name || 'fid'
          );
        }
      });

      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      // Browser doesn't support FID
    }

    // INP - Interaction to Next Paint (newer metric replacing FID)
    try {
      const inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const inpEntry = entry as any;
          trackWebVital(
            'INP',
            inpEntry.processingStart - inpEntry.startTime,
            inpEntry.name || 'inp'
          );
        }
      });

      inpObserver.observe({ entryTypes: ['event'] });
    } catch (e) {
      // Browser doesn't support INP
    }

    // TTFB - Time to First Byte
    try {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        const ttfb = navigation.responseStart - navigation.requestStart;
        trackWebVital('TTFB', ttfb, 'ttfb', undefined, navigation.type);
      }
    } catch (e) {
      // Browser doesn't support TTFB
    }
  }
}
