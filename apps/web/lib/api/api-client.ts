/**
 * 🔐 Secure API Client
 * 
 * A fetch wrapper that automatically handles:
 * - Authentication headers
 * - Token refresh on 401
 * - Credentials for httpOnly cookies
 * - Redirect to login on auth failure
 * 
 * 🔒 Uses centralized refreshOnce() from client.ts - NEVER make direct refresh calls!
 */

import { API_URL } from '@/lib/config';
import { 
  getAccessToken, 
  clearAccessToken, 
  getRefreshState,
  refreshOnce,
} from './client';

interface SecureFetchOptions extends RequestInit {
  skipAuth?: boolean;
  skipRefresh?: boolean;
}

// Auth pages where redirect should NOT happen
const AUTH_PAGES = [
  '/login',
  '/register',
  '/quicksign',
  '/complete-profile',
  '/auth/',
  '/forgot-password',
  '/reset-password',
];

/**
 * Handle authentication failure - redirect to login
 * 🔒 Note: refreshOnce() already handles auth failure, this is just for secureFetch edge cases
 */
function handleAuthFailure(reason: 'expired' | 'invalid' = 'expired'): void {
  clearAccessToken();
  
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    // 🔒 Don't redirect if already on auth pages
    const isAuthPage = AUTH_PAGES.some(page => pathname.startsWith(page));
    if (!isAuthPage) {
      window.location.href = `/login?session=${reason}`;
    }
  }
}

/**
 * 🔒 DEPRECATED: Use refreshOnce() from client.ts directly
 * This wrapper is kept for backwards compatibility
 */
async function refreshAccessToken(): Promise<boolean> {
  const result = await refreshOnce();
  return result.success;
}

/**
 * Secure fetch that includes authentication and handles 401
 */
export async function secureFetch(
  url: string,
  options: SecureFetchOptions = {}
): Promise<Response> {
  const { skipAuth = false, skipRefresh = false, headers: customHeaders, ...restOptions } = options;
  const { refreshFailed, isLoggingOut } = getRefreshState();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  // Add auth token if available and not skipped
  let token = skipAuth ? null : getAccessToken();
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, {
    ...restOptions,
    headers,
    credentials: 'include',
  });

  // Handle 401 - try to refresh (tokens are in httpOnly cookies)
  // Don't attempt refresh if logging out or refresh already failed
  if (response.status === 401 && !skipRefresh && !refreshFailed && !isLoggingOut) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry: new access token is in cookie, no Authorization header needed
      response = await fetch(url, {
        ...restOptions,
        headers,
        credentials: 'include',
      });
    }
  }

  return response;
}

/**
 * GET request helper
 */
export async function secureGet<T>(url: string): Promise<T> {
  const response = await secureFetch(url);
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status}`);
  }
  return response.json();
}

/**
 * POST request helper
 */
export async function securePost<T>(url: string, data?: unknown): Promise<T> {
  const response = await secureFetch(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) {
    throw new Error(`POST ${url} failed: ${response.status}`);
  }
  return response.json();
}

export default secureFetch;
