import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 🌐 Subdomain Routing & Route Protection Proxy
 *
 * Handles:
 * 1. Subdomain routing (production only)
 *    - app.rukny.io       → Dashboard (clean URLs, rewrite to /app/*)
 *    - accounts.rukny.io  → Auth pages (/login, /complete-profile, etc.)
 *    - rukny.io           → Public pages (landing, /[username], /f/[slug])
 *
 * 2. Route protection (all environments)
 *    - Protected routes without session → redirect to login
 *    - Auth routes with active session → redirect to dashboard
 *
 * Development (localhost): Path-based routing, only route protection active.
 */

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

const APP_PATH_PREFIX = '/app';

const PROTECTED_PREFIXES = [
  '/app',
];

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
    return null;
  }

  return null;
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isAppPath(pathname: string): boolean {
  return pathname === APP_PATH_PREFIX || pathname.startsWith(`${APP_PATH_PREFIX}/`);
}

function shouldSkip(pathname: string): boolean {
  return SKIP_PATHS.some((path) => pathname.startsWith(path));
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
  protocol: string,
): string {
  const domain = subdomain ? `${subdomain}.${rootDomain}` : rootDomain;
  return `${protocol}://${domain}${pathname}${search}`;
}

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

function isProtectedPath(resolvedPathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => resolvedPathname === prefix || resolvedPathname.startsWith(`${prefix}/`),
  );
}

function buildLoginUrl(
  callbackPath: string,
  subdomain: string | null,
  rootDomain: string,
  protocol: string,
): string {
  if (subdomain !== null) {
    return `${protocol}://accounts.${rootDomain}/login?callbackUrl=${encodeURIComponent(callbackPath)}`;
  }

  return `/login?callbackUrl=${encodeURIComponent(callbackPath)}`;
}

function buildAppRedirectUrl(
  subdomain: string | null,
  rootDomain: string,
  protocol: string,
): string {
  if (subdomain !== null) {
    return `${protocol}://app.${rootDomain}/`;
  }

  return '/app';
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host');

  if (!hostname) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Proxy] Missing hostname header. Falling back to next().');
    }
    return NextResponse.next();
  }

  if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_ROOT_DOMAIN) {
    console.warn(
      '[Proxy] NEXT_PUBLIC_ROOT_DOMAIN not set. Subdomain routing may not work correctly. ' +
        'Please set NEXT_PUBLIC_ROOT_DOMAIN environment variable.',
    );
  }

  if (shouldSkip(pathname)) {
    return NextResponse.next();
  }

  const isLocal = isLocalhost(hostname);
  const userHasSession = hasSession(request);

  if (isLocal) {
    if (isProtectedPath(pathname) && !userHasSession) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (isAuthPath(pathname) && userHasSession) {
      const authExceptions = ['/auth/callback', '/complete-profile', '/welcome'];
      const isException = authExceptions.some((path) => pathname === path || pathname.startsWith(`${path}/`));
      const hasSessionExpired =
        request.nextUrl.searchParams.get('session') === 'expired' ||
        request.nextUrl.searchParams.get('session') === 'invalid';

      if (!isException && !hasSessionExpired) {
        return NextResponse.redirect(new URL('/app', request.url));
      }
    }

    return NextResponse.next();
  }

  const subdomain = getSubdomain(hostname);
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'rukny.io';
  const protocol =
    request.headers.get('x-forwarded-proto') ||
    (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const search = request.nextUrl.search;

  if (subdomain === 'app') {
    if (pathname.startsWith('/f/')) {
      return NextResponse.redirect(
        new URL(buildSubdomainUrl(null, pathname, search, rootDomain, protocol)),
      );
    }

    if (isAuthPath(pathname)) {
      return NextResponse.redirect(
        new URL(buildSubdomainUrl('accounts', pathname, search, rootDomain, protocol)),
      );
    }

    if (isAppPath(pathname)) {
      const cleanPath = pathname.replace(/^\/app/, '') || '/';
      return NextResponse.redirect(
        new URL(buildSubdomainUrl('app', cleanPath, search, rootDomain, protocol)),
      );
    }

    if (!userHasSession) {
      const callbackPath = pathname === '/' ? '/' : pathname;
      return NextResponse.redirect(
        new URL(buildLoginUrl(callbackPath, subdomain, rootDomain, protocol)),
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = `/app${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (subdomain === 'accounts') {
    if (pathname === '/') {
      const hasSessionExpired =
        request.nextUrl.searchParams.get('session') === 'expired' ||
        request.nextUrl.searchParams.get('session') === 'invalid';

      if (userHasSession && !hasSessionExpired) {
        return NextResponse.redirect(
          new URL(buildAppRedirectUrl(subdomain, rootDomain, protocol)),
        );
      }

      return NextResponse.redirect(
        new URL(buildSubdomainUrl('accounts', '/login', search, rootDomain, protocol)),
      );
    }

    if (isAppPath(pathname)) {
      const cleanPath = pathname.replace(/^\/app/, '') || '/';
      return NextResponse.redirect(
        new URL(buildSubdomainUrl('app', cleanPath, search, rootDomain, protocol)),
      );
    }

    if (isAuthPath(pathname)) {
      const authExceptions = ['/auth/callback', '/complete-profile', '/welcome'];
      const isException = authExceptions.some((path) => pathname === path || pathname.startsWith(`${path}/`));
      const hasSessionExpired =
        request.nextUrl.searchParams.get('session') === 'expired' ||
        request.nextUrl.searchParams.get('session') === 'invalid';

      if (userHasSession && !isException && !hasSessionExpired) {
        return NextResponse.redirect(
          new URL(buildAppRedirectUrl(subdomain, rootDomain, protocol)),
        );
      }

      return NextResponse.next();
    }

    return NextResponse.redirect(
      new URL(buildSubdomainUrl(null, pathname, search, rootDomain, protocol)),
    );
  }

  if (isAppPath(pathname)) {
    const cleanPath = pathname.replace(/^\/app/, '') || '/';
    return NextResponse.redirect(
      new URL(buildSubdomainUrl('app', cleanPath, search, rootDomain, protocol)),
    );
  }

  if (isAuthPath(pathname)) {
    return NextResponse.redirect(
      new URL(buildSubdomainUrl('accounts', pathname, search, rootDomain, protocol)),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};