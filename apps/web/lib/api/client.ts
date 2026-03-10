/**
 * 🔌 API Client - Base configuration for API calls
 * 
 * Features:
 * - Typed fetch wrapper
 * - Automatic token refresh
 * - Error handling
 * - Request/Response interceptors
 */

import { z } from 'zod';
import { API_URL, buildApiPath } from '@/lib/config';

// API Error schema
export const ApiErrorSchema = z.object({
  statusCode: z.number(),
  message: z.union([z.string(), z.array(z.string())]),
  error: z.string().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// Custom error class for API errors
export class ApiException extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: string[]
  ) {
    super(message);
    this.name = 'ApiException';
  }

  /** True when the server returned 429 Too Many Requests */
  get isRateLimited(): boolean {
    return this.statusCode === 429;
  }
}

// Request configuration
interface RequestConfig extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

// Response type wrapper
interface ApiResponse<T> {
  data: T;
  status: number;
}

/**
 * Build URL with query parameters
 * 
 * 🔒 Auth endpoints use /api/auth/ (Route Handler) instead of /api/v1/auth/
 * This ensures proper Set-Cookie header forwarding from the backend.
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  // API_URL is a relative path like /api/v1
  const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // 🔒 Use Route Handler for auth endpoints (proper cookie forwarding)
  // /api/v1/auth/* -> /api/auth/*
  let fullPath: string;
  if (path.startsWith('/auth/')) {
    fullPath = `/api${path}`; // /api/auth/refresh instead of /api/v1/auth/refresh
  } else {
    fullPath = `${baseUrl}${path}`;
  }
  
  // If no params, just return the path
  if (!params || Object.keys(params).length === 0) {
    return fullPath;
  }
  
  // Build query string manually for relative paths
  const queryParts: string[] = [];
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  });
  
  const queryString = queryParts.join('&');
  return queryString ? `${fullPath}?${queryString}` : fullPath;
}

/**
 * 🔒 CSRF Token Management
 * Access Token is now in httpOnly cookie (not accessible from JS)
 * We only need to manage CSRF token on the client
 */
let csrfToken: string | null = null;

/**
 * Get CSRF token (for protected requests)
 */
export function getCsrfToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Try memory first
  if (csrfToken) {
    // CSRF token found in memory
    return csrfToken;
  }
  
  // Then try to read from cookie (persisted)
  // CSRF cookie is not httpOnly, so we can read it
  const match = document.cookie.match(/(?:^|; )(?:__Secure-)?csrf_token=([^;]*)/);
  if (match) {
    csrfToken = match[1];
    // CSRF token found in cookie
    return csrfToken;
  }
  
  // No CSRF token found
  return null;
}

/**
 * Store CSRF token (from login response)
 * Store both in memory and as a cookie for persistence across page reloads
 */
export function setCsrfToken(token: string): void {
  if (!token) {
    // Attempted to set empty CSRF token
    return;
  }
  
  // Storing CSRF token
  
  // Store in memory for immediate access
  csrfToken = token;
  
  // Also store in a regular (non-httpOnly) cookie for persistence
  if (typeof window === 'undefined') {
    // Cannot set cookie - SSR environment
    return;
  }
  
  const isSecure = window.location.protocol === 'https:';
  const cookieParts = [
    `csrf_token=${encodeURIComponent(token)}`,
    'Path=/',
    'Max-Age=' + (24 * 60 * 60), // 24 hours
    'SameSite=Lax', // Lax for OAuth flow
  ];
  
  if (isSecure) {
    cookieParts.push('Secure');
  }
  
  const cookieString = cookieParts.join('; ');
  // CSRF cookie set
  document.cookie = cookieString;
  
  // Verify it was set
  const verify = document.cookie.includes('csrf_token');
  // CSRF cookie verification
}

/**
 * Clear CSRF token
 */
export function clearCsrfToken(): void {
  csrfToken = null;
  
  // Clear from cookie as well
  if (typeof window === 'undefined') return;
  document.cookie = 'csrf_token=; Path=/; Max-Age=0; SameSite=Lax';
}

/**
 * @deprecated Access token is now in httpOnly cookie
 * This function returns null - kept for backwards compatibility
 */
export function getAccessToken(): string | null {
  // Access token is in httpOnly cookie, not accessible from JS
  // Return null - the browser will send the cookie automatically
  return null;
}

/**
 * @deprecated Access token is now in httpOnly cookie
 */
export function setAccessToken(token: string): void {
  // No-op - access token is managed via httpOnly cookie
  // setAccessToken is deprecated - token is in httpOnly cookie
}

/**
 * @deprecated Use clearCsrfToken instead
 */
export function clearAccessToken(): void {
  clearCsrfToken();
}

// ===== Refresh Token Protection (Global Mutex) =====
// 🔒 Golden Rule: ONE refresh at a time, all callers wait for the SAME promise
// 🔒 Using window for TRUE global state (survives module reloads)

const REFRESH_STATE_KEY = '__rukny_refresh_state__';

interface RefreshState {
  refreshFailed: boolean;
  isLoggingOut: boolean;
  refreshPromise: Promise<RefreshResult> | null;
  lastRefreshTime: number;
  expiresInSeconds: number | null;
}

function getGlobalRefreshState(): RefreshState {
  if (typeof window === 'undefined') {
    // SSR: return isolated state
    return {
      refreshFailed: false,
      isLoggingOut: false,
      refreshPromise: null,
      lastRefreshTime: Date.now(),
      expiresInSeconds: null,
    };
  }
  
  // Browser: use window for TRUE global state
  if (!(window as any)[REFRESH_STATE_KEY]) {
    (window as any)[REFRESH_STATE_KEY] = {
      refreshFailed: false,
      isLoggingOut: false,
      refreshPromise: null,
      lastRefreshTime: Date.now(),
      expiresInSeconds: null,
    } as RefreshState;
  }
  return (window as any)[REFRESH_STATE_KEY];
}

// 🔒 Cross-page-load protection: prevent hammering refresh when session is invalid
const REFRESH_FAILED_KEY = 'rukny_refresh_failed';
const REFRESH_FAILED_TTL_MS = 30_000; // 30 seconds cooldown after failure

function isRefreshBlockedByPreviousFailure(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = sessionStorage.getItem(REFRESH_FAILED_KEY);
    if (!stored) return false;
    const failedAt = parseInt(stored, 10);
    if (Date.now() - failedAt < REFRESH_FAILED_TTL_MS) {
      return true; // Still in cooldown period
    }
    sessionStorage.removeItem(REFRESH_FAILED_KEY);
  } catch {
    // sessionStorage not available
  }
  return false;
}

function markRefreshFailed(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(REFRESH_FAILED_KEY, Date.now().toString());
  } catch {
    // sessionStorage not available
  }
}

function clearRefreshFailedMark(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(REFRESH_FAILED_KEY);
  } catch {
    // sessionStorage not available
  }
}

/** Result returned by refreshOnce() */
export interface RefreshResult {
  success: boolean;
  csrfToken?: string;
  expiresIn?: number;
  user?: any; // User data from refresh response (eliminates /auth/me call)
}

/**
 * Update the last refresh time (for session timeout warning)
 */
export function updateLastRefreshTime(): void {
  const state = getGlobalRefreshState();
  state.lastRefreshTime = Date.now();
}

/**
 * Update the last known access token expiry (seconds)
 */
export function updateLastExpiresIn(expiresInSeconds: number): void {
  const state = getGlobalRefreshState();
  state.expiresInSeconds = Number.isFinite(expiresInSeconds) ? expiresInSeconds : null;
}

/**
 * Get the last known access token expiry (seconds)
 */
export function getLastExpiresIn(): number | null {
  return getGlobalRefreshState().expiresInSeconds;
}

/**
 * Compute session expiry timestamp in ms, if known.
 */
export function getSessionExpiresAtMs(): number | null {
  const state = getGlobalRefreshState();
  if (!state.expiresInSeconds) return null;
  return state.lastRefreshTime + state.expiresInSeconds * 1000;
}

/**
 * Set logout state to prevent refresh attempts during logout
 */
export function setLoggingOut(value: boolean): void {
  const state = getGlobalRefreshState();
  state.isLoggingOut = value;
  if (value) {
    // When logging out, clear refresh state
    state.refreshFailed = true;
    state.refreshPromise = null;
    clearSilentRefresh();
  }
}

// ===== Silent Refresh (تقليل انقطاع الجلسة) =====
let silentRefreshTimerId: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedule a single silent refresh before access token expires.
 * ⚡ Performance: Refresh at ~50% of expires_in to handle slow Neon cold starts
 * - 50% gives ~15 min buffer for 30 min tokens
 * - Min 2 min to avoid excessive refresh attempts
 * 🔒 Uses refreshOnce() to respect the global mutex
 */
export function scheduleSilentRefresh(expiresInSeconds: number): void {
  if (typeof window === 'undefined') return;
  clearSilentRefresh();
  // ⚡ Changed from 80% to 50% - gives more buffer for slow DB connections
  const ms = Math.max(120_000, Math.floor(expiresInSeconds * 0.5) * 1000);
  silentRefreshTimerId = setTimeout(async () => {
    silentRefreshTimerId = null;
    // 🔒 Use the global mutex - no direct fetch!
    await refreshOnce();
  }, ms);
}

/**
 * Clear silent refresh timer (e.g. on logout).
 */
export function clearSilentRefresh(): void {
  if (silentRefreshTimerId) {
    clearTimeout(silentRefreshTimerId);
    silentRefreshTimerId = null;
  }
}

/**
 * Get the last refresh time
 */
export function getLastRefreshTime(): number {
  return getGlobalRefreshState().lastRefreshTime;
}

/**
 * Get current refresh state
 */
export function getRefreshState(): { isRefreshing: boolean; refreshFailed: boolean; isLoggingOut: boolean } {
  const state = getGlobalRefreshState();
  return { 
    isRefreshing: state.refreshPromise !== null, 
    refreshFailed: state.refreshFailed, 
    isLoggingOut: state.isLoggingOut 
  };
}

/**
 * 🔒 GOLDEN RULE: Single entry point for ALL refresh operations
 * 
 * - Only ONE fetch('/api/auth/refresh') happens at a time
 * - All concurrent callers wait for the SAME promise
 * - Handles CSRF token update and silent refresh scheduling
 * - Uses window-level state for TRUE cross-module mutex
 * 
 * @returns RefreshResult with success status and tokens
 */
export async function refreshOnce(): Promise<RefreshResult> {
  const state = getGlobalRefreshState();
  
  // 🚪 Don't attempt refresh during logout
  if (state.isLoggingOut) {
    return { success: false };
  }

  // If refresh already failed this session (in-memory), don't try again
  if (state.refreshFailed) {
    return { success: false };
  }
  
  // 🔒 Cross-page protection: check if refresh failed recently in another page load
  if (isRefreshBlockedByPreviousFailure()) {
    state.refreshFailed = true; // Sync in-memory state
    // 🔒 Must call handleAuthFailure to trigger redirect instead of silently returning
    handleAuthFailure('expired');
    return { success: false };
  }

  // 🔒 MUTEX: If already refreshing, wait for the SAME promise
  if (state.refreshPromise) {
    return state.refreshPromise;
  }

  // Create the single shared promise
  state.refreshPromise = (async (): Promise<RefreshResult> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Refresh failed - session is invalid
        handleAuthFailure('expired');
        return { success: false };
      }

      const data = await response.json();
      if (data.success && data.csrf_token) {
        // 🔒 Update CSRF token from response
        setCsrfToken(data.csrf_token);
        updateLastRefreshTime();
        if (typeof data.expires_in === 'number') {
          updateLastExpiresIn(data.expires_in);
        }
        
        // Schedule next silent refresh
        if (typeof data.expires_in === 'number') {
          scheduleSilentRefresh(data.expires_in);
        }
        
        return {
          success: true,
          csrfToken: data.csrf_token,
          expiresIn: data.expires_in,
          user: data.user || null, // 🔒 User data from refresh (eliminates /auth/me)
        };
      }

      handleAuthFailure('invalid');
      return { success: false };
    } catch {
      handleAuthFailure('expired');
      return { success: false };
    } finally {
      // 🔒 Clear the promise so next refresh can start fresh
      const s = getGlobalRefreshState();
      s.refreshPromise = null;
    }
  })();

  return state.refreshPromise;
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
 */
function handleAuthFailure(reason: 'expired' | 'invalid' = 'expired'): void {
  const state = getGlobalRefreshState();
  clearAccessToken();
  clearSilentRefresh();
  state.refreshFailed = true;
  state.refreshPromise = null;
  
  // 🔒 Mark failure in sessionStorage to prevent hammering across page loads
  markRefreshFailed();
  
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;

    // Only auto-redirect on protected app routes.
    // Public pages like '/' should not force a login redirect.
    const isProtectedRoute = pathname === '/app' || pathname.startsWith('/app/');

    // 🔒 Don't redirect if already on auth pages
    const isAuthPage = AUTH_PAGES.some(page => pathname.startsWith(page));
    if (isProtectedRoute && !isAuthPage) {
      window.location.href = `/login?session=${reason}`;
    }
  }
}

/**
 * Reset refresh state (call after successful login)
 */
export function resetRefreshState(): void {
  const state = getGlobalRefreshState();
  state.refreshFailed = false;
  state.isLoggingOut = false;
  state.refreshPromise = null;
  clearSilentRefresh();
  // 🔒 Clear sessionStorage mark so user can refresh after re-login
  clearRefreshFailedMark();
}

/**
 * @deprecated Use refreshOnce() directly instead
 * Kept for backwards compatibility with existing code
 */
async function refreshAccessToken(): Promise<boolean> {
  const result = await refreshOnce();
  return result.success;
}

/**
 * Main API client function
 * 
 * 🔒 Security:
 * - Access Token: sent via httpOnly cookie (automatic)
 * - CSRF Token: sent via X-CSRF-Token header (for state-changing requests)
 */
async function apiClient<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const { body, params, headers: customHeaders, method = 'GET', ...restConfig } = config;
  const startTime = typeof window !== 'undefined' ? performance.now() : 0;

  const url = buildUrl(endpoint, params);

  // Default headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  // 🔒 Add CSRF token for state-changing requests
  const csrfToken = getCsrfToken();
  if (csrfToken && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    (headers as Record<string, string>)['X-CSRF-Token'] = csrfToken;
  }

  let response: Response;
  let success = true;
  let error: string | undefined;

  try {
    // Make the request (cookies sent automatically)
    response = await fetch(url, {
      ...restConfig,
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include', // 🔒 Send httpOnly cookies
    });

    // Handle 401 - Try to refresh token
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      
      if (refreshed) {
        // Update CSRF token in headers for retry
        const newCsrfToken = getCsrfToken();
        if (newCsrfToken && method !== 'GET') {
          (headers as Record<string, string>)['X-CSRF-Token'] = newCsrfToken;
        }
        
        // Retry the request (new access token is in cookie)
        response = await fetch(url, {
          ...restConfig,
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          credentials: 'include',
        });
      }
    }

    // Handle 429 - Rate limited: retry once after delay
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const delayMs = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 10_000) : 3_000;
      await new Promise(resolve => setTimeout(resolve, delayMs));
      response = await fetch(url, {
        ...restConfig,
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
      });
    }

    // Parse response
    const responseData = await response.json().catch(() => ({}));

    // Handle errors
    if (!response.ok) {
      success = false;
      const errorMessage = Array.isArray(responseData.message)
        ? responseData.message.join(', ')
        : responseData.message || 'An error occurred';

      error = errorMessage;

      throw new ApiException(
        response.status,
        errorMessage,
        Array.isArray(responseData.message) ? responseData.message : undefined
      );
    }

    // Track API performance
    if (typeof window !== 'undefined' && startTime > 0) {
      const duration = performance.now() - startTime;
      import('@/lib/performance').then(({ trackApiRequest }) => {
        trackApiRequest(endpoint, method, duration, response.status, success);
      });
    }

    return {
      data: responseData as T,
      status: response.status,
    };
  } catch (err) {
    success = false;
    error = err instanceof Error ? err.message : 'Unknown error';

    // Track failed API request
    if (typeof window !== 'undefined' && startTime > 0) {
      const duration = performance.now() - startTime;
      import('@/lib/performance').then(({ trackApiRequest }) => {
        trackApiRequest(endpoint, method, duration, 0, false, error);
      });
    }

    throw err;
  }
}

// HTTP method helpers
export const api = {
  get: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) =>
    apiClient<T>(endpoint, { method: 'GET', params }),

  post: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: 'PATCH', body }),

  delete: <T>(endpoint: string) =>
    apiClient<T>(endpoint, { method: 'DELETE' }),
};

/**
 * Storage / upload API client used by useStorage.
 * - get: returns response data (unwraps api.get)
 * - upload: FormData POST (no Content-Type)
 * - delete: void
 */
export function getApiClient() {
  const strip = (s: string) => s.replace(/^\/+/, '');

  return {
    async get<T>(endpoint: string): Promise<T> {
      const res = await api.get<T>(endpoint);
      return (res as ApiResponse<T>).data;
    },

    async upload<T>(endpoint: string, formData: FormData): Promise<T> {
      const path = buildApiPath(strip(endpoint));
      const token = getAccessToken();
      const res = await fetch(path, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message ?? `Upload failed: ${res.status}`);
      }
      return res.json();
    },

    async post<T = void>(endpoint: string, body?: unknown): Promise<T> {
      const res = await api.post<T>(endpoint, body);
      return (res as ApiResponse<T>).data;
    },

    async delete(endpoint: string): Promise<void> {
      await api.delete(endpoint);
    },
  };
}

export default api;
