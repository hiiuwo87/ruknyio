/**
 * 🔐 Server-side API Client
 * 
 * Forwards httpOnly cookies (access_token, refresh_token) from the browser 
 * request to the NestJS backend.
 *
 * Used inside Server Components, Server Actions, and Route Handlers.
 */

import { cookies, headers } from 'next/headers';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const API_PREFIX = '/api/v1';

type FetchOptions = RequestInit & {
  /** Skip forwarding browser cookies to backend */
  skipCookies?: boolean;
  /** Skip CSRF validation */
  skipCsrf?: boolean;
};

/**
 * Server-side API client that forwards httpOnly cookies (access_token, refresh_token)
 * from the browser request to the NestJS backend.
 *
 * Used inside Server Components, Server Actions, and Route Handlers.
 */
export async function apiClient<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  const { skipCookies = false, skipCsrf = false, ...fetchOptions } = options;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_URL}${API_PREFIX}${normalizedPath}`;

  // Build headers
  const reqHeaders = new Headers(fetchOptions.headers);

  // Forward cookies from the incoming browser request
  if (!skipCookies) {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    if (cookieHeader) {
      reqHeaders.set('Cookie', cookieHeader);
    }
  }

  // Forward CSRF token for mutating requests
  if (!skipCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(fetchOptions.method?.toUpperCase() ?? '')) {
    const cookieStore = await cookies();
    const csrf = cookieStore.get('csrf_token')?.value;
    if (csrf) {
      reqHeaders.set('x-csrf-token', csrf);
    }
  }

  // Forward origin / referer for backend CSRF validation
  const headersList = await headers();
  const origin = headersList.get('origin');
  const referer = headersList.get('referer');
  if (origin) reqHeaders.set('origin', origin);
  if (referer) reqHeaders.set('referer', referer);

  // Default content type
  if (!reqHeaders.has('Content-Type') && fetchOptions.body && typeof fetchOptions.body === 'string') {
    reqHeaders.set('Content-Type', 'application/json');
  }

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      headers: reqHeaders,
      // Don't follow redirects — we handle them ourselves
      redirect: 'manual',
      // Always fetch fresh data — never serve stale cache
      cache: 'no-store',
    });

    // Handle redirects (e.g., OAuth flows)
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      return {
        data: { redirectUrl: res.headers.get('location') } as T,
        error: null,
        status: res.status,
      };
    }

    // Forward Set-Cookie headers from the backend to the browser
    const setCookieHeaders = res.headers.getSetCookie?.() ?? [];
    if (setCookieHeaders.length > 0) {
      const cookieStore = await cookies();
      for (const raw of setCookieHeaders) {
        const parsed = parseSetCookie(raw);
        if (parsed) {
          cookieStore.set(parsed.name, parsed.value, parsed.options);
        }
      }
    }

    // Empty responses
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return { data: null, error: null, status: res.status };
    }

    const contentType = res.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');

    if (!res.ok) {
      const errorBody = isJson ? await res.json() : await res.text();
      const message =
        typeof errorBody === 'object' && errorBody?.message
          ? errorBody.message
          : typeof errorBody === 'string'
            ? errorBody
            : 'خطأ غير معروف';
      return { data: null, error: message, status: res.status };
    }

    const data = isJson ? await res.json() : await res.text();
    return { data: data as T, error: null, status: res.status };
  } catch (err) {
    console.error('[apiClient] fetch error:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'فشل الاتصال بالخادم',
      status: 0,
    };
  }
}

// ─── Cookie Parser ────────────────────────────────────────────

interface ParsedCookie {
  name: string;
  value: string;
  options: {
    path?: string;
    domain?: string;
    maxAge?: number;
    expires?: Date;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'lax' | 'strict' | 'none';
  };
}

function parseSetCookie(raw: string): ParsedCookie | null {
  const parts = raw.split(';').map((p) => p.trim());
  const [first, ...rest] = parts;
  if (!first) return null;

  const eqIdx = first.indexOf('=');
  if (eqIdx === -1) return null;

  const name = first.slice(0, eqIdx).trim();
  const value = first.slice(eqIdx + 1).trim();

  const options: ParsedCookie['options'] = {};

  for (const attr of rest) {
    const lower = attr.toLowerCase();
    if (lower === 'httponly') {
      options.httpOnly = true;
    } else if (lower === 'secure') {
      options.secure = true;
    } else if (lower.startsWith('path=')) {
      options.path = attr.slice(5);
    } else if (lower.startsWith('domain=')) {
      options.domain = attr.slice(7);
    } else if (lower.startsWith('max-age=')) {
      options.maxAge = parseInt(attr.slice(8), 10);
    } else if (lower.startsWith('expires=')) {
      options.expires = new Date(attr.slice(8));
    } else if (lower.startsWith('samesite=')) {
      const val = attr.slice(9).toLowerCase();
      if (val === 'lax' || val === 'strict' || val === 'none') {
        options.sameSite = val;
      }
    }
  }

  return { name, value, options };
}
