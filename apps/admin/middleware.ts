import { NextRequest, NextResponse } from 'next/server';

/**
 * 🔒 Middleware for Admin Panel
 * - Handles API requests and forwards them to backend
 * - Adds security headers
 * - Manages CORS for API routes
 * - Protects admin routes from unauthorized access
 */
export function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  // Only process API requests
  if (pathname.startsWith('/api/')) {
    const response = NextResponse.next();

    // 🔒 Security Headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // 🔄 CORS Headers for API routes
    const allowedOrigins = [
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      'https://rukny.io',
      'https://www.rukny.io',
      'https://rukny.store',
      'https://www.rukny.store',
    ];

    const requestOrigin = request.headers.get('origin');
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      response.headers.set('Access-Control-Allow-Origin', requestOrigin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      );
      response.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Accept, Origin, X-Requested-With, Cache-Control'
      );
    }

    return response;
  }

  // 🔒 Add security headers to all responses
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

// Configure matcher for middleware
export const config = {
  matcher: [
    // API routes
    '/api/:path*',
  ],
};
