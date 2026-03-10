/**
 * ⚙️ Centralized Configuration
 * 
 * All app configuration in one place for easy management and validation
 * 
 * API URL Strategy:
 * - API_URL: Relative path (/api/v1) for fetch requests (uses Next.js rewrites/proxy)
 * - API_EXTERNAL_URL: Full URL for browser redirects (OAuth, magic links)
 * 
 * Subdomain Strategy:
 * - Production: app.rukny.io (dashboard), auth.rukny.io (login/register), rukny.io (public)
 * - Development: path-based routing on localhost (no subdomains)
 */

import { z } from 'zod';
import { getAppUrl, getAuthUrl, getPublicUrl, getLoginUrl } from '@/lib/url';

// ============ Environment Schema ============

const EnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
});

// Validate environment variables
const env = EnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NODE_ENV: process.env.NODE_ENV,
});

// ============ API Configuration ============

/**
 * API Base URL (relative) - For fetch requests that go through Next.js proxy
 * Uses httpOnly cookies properly since it's same-origin
 */
export const API_URL = '/api/v1';

/**
 * App URL - The frontend URL
 * Prefer runtime origin in the browser to avoid build-time env gaps.
 */
const runtimeAppUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
export const APP_URL = env.NEXT_PUBLIC_APP_URL || runtimeAppUrl || 'http://localhost:3000';

/**
 * API External URL - For browser redirects (OAuth, magic links)
 * This bypasses the proxy and goes directly to the API server
 */
export const API_EXTERNAL_URL = env.NEXT_PUBLIC_API_URL?.startsWith('http') 
  ? env.NEXT_PUBLIC_API_URL 
  : `${APP_URL}/api/v1`;

/**
 * Build API path for fetch requests (relative)
 */
export function buildApiPath(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return `${API_URL}/${clean}`;
}

/**
 * Build external API URL for browser redirects
 */
export function buildApiExternalUrl(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return `${API_EXTERNAL_URL}/${clean}`;
}

// ============ Route Configuration ============

/**
 * Routes that require authentication
 */
export const protectedRoutes: string[] = [
  '/app',
  '/profile',
  '/settings',
  '/stores',
  '/events',
  '/forms',
];

/**
 * Routes that should redirect to /app if authenticated
 * (QuickSign uses magic links, so no traditional register/forgot-password)
 */
export const authRoutes: string[] = [
  '/login',
  '/check-email',
];

/**
 * Public routes that don't need any checks
 */
export const publicRoutes = [
  '/',
  '/about',
  '/contact',
  '/pricing',
] as const;

// ============ App Configuration ============

export const config = {
  api: {
    url: API_URL,
    buildPath: buildApiPath,
  },
  routes: {
    protected: protectedRoutes,
    auth: authRoutes,
    public: publicRoutes,
  },
  urls: {
    app: getAppUrl,
    auth: getAuthUrl,
    public: getPublicUrl,
    login: getLoginUrl,
  },
  app: {
    name: 'ركني',
    description: 'مركزك الرقمي للأعمال',
  },
} as const;

// Re-export URL helpers for convenience
export { getAppUrl, getAuthUrl, getPublicUrl, getLoginUrl } from '@/lib/url';

export default config;
