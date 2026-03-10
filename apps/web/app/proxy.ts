import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 🌐 Subdomain Routing & Route Protection Proxy
 * 
 * Handles:
 * 1. Subdomain routing (production only)
 *    - app.rukny.io     → Dashboard (clean URLs, rewrite to /app/*)
 *    - accounts.rukny.io → Auth pages (/login, /complete-profile, etc.)
 *    - rukny.io          → Public pages (landing, /[username], /f/[slug])
 * 
 * 2. Route protection (all environments)
 *    - Protected routes without session → redirect to login
 *    - Auth routes with active session → redirect to dashboard
 * 
 * Development (localhost): Path-based routing, only route protection active.
 */

// Auth-related paths (map to accounts.rukny.io in production)
const AUTH_PATHS = [
  '/login',
  '/check-email',
  '/quicksign',
  '/auth/callback',
  '/auth/verify',
  '/auth/verify-2fa',
  '/welcome',
  '/complete-profile',
];

// App dashboard paths (map to app.rukny.io in production)
const APP_PATH_PREFIX = '/app';

// Protected route prefixes that require authentication
const PROTECTED_PREFIXES = [
  '/app',
];

// Paths that should be skipped
const SKIP_PATHS = [
  '/api/',
  '/uploads/',
  '/_next/',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
  '/icons/',
  '/logos/',
  '/offline',
];

/**
 * Extract subdomain from hostname
 * e.g., "app.rukny.io" → "app", "rukny.io" → null
 * 
 * Uses URL API for safer hostname parsing (handles edge cases with ports, IPv6, etc.)
 */
function getSubdomain(hostname: string): string | null {
  try {
    const url = new URL(`http://${hostname}`);
    const host = url.hostname;
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'rukny.io';
    
    if (host === rootDomain || host === `www.${rootDomain}`) {
      return null;
    }
    
    if (host.endsWith(`.${rootDomain}`)) {
      return host.replace(`.${rootDomain}`, '');
    }
  } catch {
    // Invalid hostname format, return null
    return null;
  }
  
  return null;
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'));
}

function isAppPath(pathname: string): boolean {
  return pathname === APP_PATH_PREFIX || pathname.startsWith(APP_PATH_PREFIX + '/');
}

function shouldSkip(pathname: string): boolean {
  return SKIP_PATHS.some(path => pathname.startsWith(path));
}

function isLocalhost(hostname: string): boolean {
  try {
    const url = new URL(`http://${hostname}`);
    const host = url.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1';
  } catch {
    return false;
  }
}

function buildSubdomainUrl(
  subdomain: string | null,
  pathname: string,
  search: string,
  rootDomain: string,
  protocol: string
): string {
  const domain = subdomain ? `${subdomain}.${rootDomain}` : rootDomain;
  return `${protocol}://${domain}${pathname}${search}`;
}

// ============ Auth Helpers ============

/**
 * Check if user has an active session (access or refresh token in cookies)
 * 
 * ⚠️ Note: This only checks token existence, NOT expiry or validity.
 * Backend API will perform full JWT validation on protected routes.
 * 
 * Checks both secure (__Secure-) and non-secure cookie variants for compatibility.
 */
function hasSession(request: NextRequest): boolean {
  const hasAccessToken = !!(
    request.cookies.get('__Secure-access_token')?.value ||
    request.cookies.get('access_token')?.value
  );
  const hasRefreshToken = !!(
    request.cookies.get('__Secure-refresh_token')?.value ||
    request.cookies.get('refresh_token')?.value
  );
  return hasAccessToken || hasRefreshToken;
}

/**
 * Check if the resolved path (after rewrite) is a protected route
 */
function isProtectedPath(resolvedPathname: string): boolean {
  return PROTECTED_PREFIXES.some(prefix => 
    resolvedPathname === prefix || resolvedPathname.startsWith(prefix + '/')
  );
}

/**
 * Build login URL with callback
 */
function buildLoginUrl(
  request: NextRequest,
  callbackPath: string,
  subdomain: string | null,
  rootDomain: string,
  protocol: string
): string {
  if (subdomain !== null) {
    // Production: redirect to accounts subdomain
    return `${protocol}://accounts.${rootDomain}/login?callbackUrl=${encodeURIComponent(callbackPath)}`;
  }
  // Development: same domain
  return `/login?callbackUrl=${encodeURIComponent(callbackPath)}`;
}

/**
 * Build app URL for redirecting authenticated users away from auth pages
 */
function buildAppRedirectUrl(
  request: NextRequest,
  subdomain: string | null,
  rootDomain: string,
  protocol: string
): string {
  if (subdomain !== null) {
    return `${protocol}://app.${rootDomain}/`;
  }
  return '/app';
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host');
  
  // ⚠️ Validate hostname is present
  if (!hostname) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Middleware] Missing hostname header. Falling back to next()');
    }
    return NextResponse.next();
  }

  // ⚠️ Validate ROOT_DOMAIN configuration in development
  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_ROOT_DOMAIN) {
    console.warn(
      '[Middleware] NEXT_PUBLIC_ROOT_DOMAIN not set. Subdomain routing may not work correctly. ' +
      'Please set NEXT_PUBLIC_ROOT_DOMAIN environment variable.'
    );
  }

  // Skip for static assets, API routes, etc.
  if (shouldSkip(pathname)) {
    return NextResponse.next();
  }

  const isLocal = isLocalhost(hostname);
  const userHasSession = hasSession(request);

  // ========================================
  // 🏠 Development (localhost) — Path-based only
  // ========================================
  if (isLocal) {
    // Protected route without session → redirect to login
    if (isProtectedPath(pathname) && !userHasSession) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Authenticated user on auth pages → redirect to app
    // Exception: /auth/callback and /complete-profile need to work even with session
    // Exception: session=expired query param means auth failed, don't redirect back to /app
    if (isAuthPath(pathname) && userHasSession) {
      const authExceptions = ['/auth/callback', '/complete-profile', '/welcome'];
      const isException = authExceptions.some(p => pathname === p || pathname.startsWith(p + '/'));
      const hasSessionExpired = request.nextUrl.searchParams.get('session') === 'expired' || 
                                 request.nextUrl.searchParams.get('session') === 'invalid';
      if (!isException && !hasSessionExpired) {
        return NextResponse.redirect(new URL('/app', request.url));
      }
    }

    return NextResponse.next();
  }

  // ========================================
  // 🌐 Production — Subdomain routing + protection
  // ========================================
  const subdomain = getSubdomain(hostname);
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'rukny.io';
  // Use X-Forwarded-Proto if behind a reverse proxy, fallback to NODE_ENV
  const protocol = request.headers.get('x-forwarded-proto') ||
                   (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const search = request.nextUrl.search;

  // ========================================
  // 📱 app.rukny.io — Dashboard Subdomain
  // ========================================
  if (subdomain === 'app') {
    // Public routes (/f/*, /[username]) on app subdomain → redirect to main domain
    // These routes exist at root level, not under /app
    if (pathname.startsWith('/f/')) {
      return NextResponse.redirect(
        new URL(buildSubdomainUrl(null, pathname, search, rootDomain, protocol))
      );
    }

    // Auth routes on app subdomain → redirect to accounts subdomain
    if (isAuthPath(pathname)) {
      return NextResponse.redirect(
        new URL(buildSubdomainUrl('accounts', pathname, search, rootDomain, protocol))
      );
    }

    // If path has /app prefix, redirect to strip it for clean URLs
    if (isAppPath(pathname)) {
      const cleanPath = pathname.replace(/^\/app/, '') || '/';
      return NextResponse.redirect(
        new URL(buildSubdomainUrl('app', cleanPath, search, rootDomain, protocol))
      );
    }

    // 🛡️ Route protection: all pages on app subdomain are protected
    if (!userHasSession) {
      const callbackPath = pathname === '/' ? '/' : pathname;
      return NextResponse.redirect(
        new URL(buildLoginUrl(request, callbackPath, subdomain, rootDomain, protocol))
      );
    }

    // Rewrite: prepend /app internally for clean URLs
    const url = request.nextUrl.clone();
    url.pathname = `/app${pathname}`;
    return NextResponse.rewrite(url);
  }

  // ========================================
  // 🔐 accounts.rukny.io — Auth Subdomain
  // ========================================
  if (subdomain === 'accounts') {
    if (pathname === '/') {
      // 🛡️ Authenticated user → redirect to app
      // Exception: session=expired means auth failed, don't redirect back
      const hasSessionExpired = request.nextUrl.searchParams.get('session') === 'expired' ||
                                 request.nextUrl.searchParams.get('session') === 'invalid';
      if (userHasSession && !hasSessionExpired) {
        return NextResponse.redirect(
          new URL(buildAppRedirectUrl(request, subdomain, rootDomain, protocol))
        );
      }
      return NextResponse.redirect(
        new URL(buildSubdomainUrl('accounts', '/login', search, rootDomain, protocol))
      );
    }

    if (isAppPath(pathname)) {
      return NextResponse.redirect(
        new URL(buildSubdomainUrl('app', pathname, search, rootDomain, protocol))
      );
    }

    if (isAuthPath(pathname)) {
      // 🛡️ Authenticated user on auth pages → redirect to app
      // Exception: /auth/callback and /complete-profile need to work even with session
      // Exception: session=expired means auth failed, don't redirect back
      const authExceptions = ['/auth/callback', '/complete-profile', '/welcome'];
      const isException = authExceptions.some(p => pathname === p || pathname.startsWith(p + '/'));
      const hasSessionExpired = request.nextUrl.searchParams.get('session') === 'expired' ||
                                 request.nextUrl.searchParams.get('session') === 'invalid';
      if (userHasSession && !isException && !hasSessionExpired) {
        return NextResponse.redirect(
          new URL(buildAppRedirectUrl(request, subdomain, rootDomain, protocol))
        );
      }
      return NextResponse.next();
    }

    return NextResponse.redirect(
      new URL(buildSubdomainUrl(null, pathname, search, rootDomain, protocol))
    );
  }

  // ========================================
  // 🌐 rukny.io — Main Domain (Public Only)
  // ========================================
  
  if (isAppPath(pathname)) {
    const cleanPath = pathname.replace(/^\/app/, '') || '/';
    return NextResponse.redirect(
      new URL(buildSubdomainUrl('app', cleanPath, search, rootDomain, protocol))
    );
  }

  if (isAuthPath(pathname)) {
    return NextResponse.redirect(
      new URL(buildSubdomainUrl('accounts', pathname, search, rootDomain, protocol))
    );
  }

  // Public routes pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image).*)',
  ],
};
