'use server';

import { apiClient } from '@/lib/api-client';

export interface AnalyticsSettings {
  googleAnalyticsId: string;
  isConnected: boolean;
}

/**
 * Get store's Google Analytics settings
 */
export async function getAnalyticsSettings() {
  return apiClient<AnalyticsSettings>('/stores/my-store/analytics');
}

/**
 * Update store's Google Analytics Measurement ID
 */
export async function updateAnalyticsSettings(googleAnalyticsId: string) {
  return apiClient<AnalyticsSettings>('/stores/my-store/analytics', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ googleAnalyticsId }),
  });
}

/**
 * Disconnect Google Analytics (clear measurement ID)
 */
export async function disconnectAnalytics() {
  return apiClient<AnalyticsSettings>('/stores/my-store/analytics', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ googleAnalyticsId: '' }),
  });
}
