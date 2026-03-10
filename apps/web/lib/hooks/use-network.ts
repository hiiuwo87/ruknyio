'use client';

/**
 * 🌐 Network Status Hook
 * 
 * Provides information about network connection status and quality
 * for connection-aware loading strategies.
 */

import { useState, useEffect, useCallback } from 'react';

// Network Information API types
interface NetworkInformation extends EventTarget {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  downlink: number;
  rtt: number;
  saveData: boolean;
  onchange: ((this: NetworkInformation, ev: Event) => void) | null;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

export interface NetworkStatus {
  /** Is the device online */
  isOnline: boolean;
  /** Effective connection type */
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  /** Downlink speed in Mbps */
  downlink: number;
  /** Round-trip time in ms */
  rtt: number;
  /** User has enabled data saver */
  saveData: boolean;
  /** Is the connection considered slow */
  isSlow: boolean;
  /** Is the connection considered fast */
  isFast: boolean;
}

const defaultStatus: NetworkStatus = {
  isOnline: true,
  effectiveType: 'unknown',
  downlink: 10,
  rtt: 50,
  saveData: false,
  isSlow: false,
  isFast: true,
};

/**
 * Hook to get network status and quality
 */
export function useNetwork(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(defaultStatus);

  const updateStatus = useCallback(() => {
    if (typeof navigator === 'undefined') return;

    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    const isOnline = navigator.onLine;

    if (connection) {
      const effectiveType = connection.effectiveType || 'unknown';
      const downlink = connection.downlink || 10;
      const rtt = connection.rtt || 50;
      const saveData = connection.saveData || false;

      // Consider slow if 2g/slow-2g or high RTT or low downlink
      const isSlow =
        effectiveType === 'slow-2g' ||
        effectiveType === '2g' ||
        rtt > 400 ||
        downlink < 1 ||
        saveData;

      const isFast = effectiveType === '4g' && rtt < 100 && downlink > 5;

      setStatus({
        isOnline,
        effectiveType,
        downlink,
        rtt,
        saveData,
        isSlow,
        isFast,
      });
    } else {
      setStatus((prev) => ({
        ...prev,
        isOnline,
      }));
    }
  }, []);

  useEffect(() => {
    // Initial update
    updateStatus();

    // Listen for online/offline events
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    // Listen for connection changes
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;

    if (connection) {
      connection.addEventListener('change', updateStatus);
    }

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);

      if (connection) {
        connection.removeEventListener('change', updateStatus);
      }
    };
  }, [updateStatus]);

  return status;
}

/**
 * Hook to get image quality based on connection
 */
export function useAdaptiveImageQuality(): 'low' | 'medium' | 'high' {
  const { isSlow, saveData, effectiveType } = useNetwork();

  if (saveData || effectiveType === 'slow-2g') {
    return 'low';
  }

  if (isSlow || effectiveType === '2g' || effectiveType === '3g') {
    return 'medium';
  }

  return 'high';
}

/**
 * Hook to determine if heavy content should be loaded
 */
export function useShouldLoadHeavyContent(): boolean {
  const { isSlow, saveData, isOnline } = useNetwork();
  return isOnline && !isSlow && !saveData;
}

/**
 * Hook to get prefetch strategy based on connection
 */
export function usePrefetchStrategy(): 'aggressive' | 'conservative' | 'none' {
  const { isFast, isSlow, saveData, isOnline } = useNetwork();

  if (!isOnline || saveData) {
    return 'none';
  }

  if (isFast) {
    return 'aggressive';
  }

  if (isSlow) {
    return 'none';
  }

  return 'conservative';
}

export default useNetwork;
