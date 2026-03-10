/**
 * 🌐 URL Helper - Generates correct URLs based on environment
 * 
 * Production: Uses subdomains (app.rukny.io, auth.rukny.io)
 * Development: Uses path-based routing on localhost
 * 
 * Note: In production, app routes keep the /app prefix (app.rukny.io/app/settings)
 * to avoid breaking internal path checks.
 * 
 * Usage:
 *   import { getAppUrl, getAuthUrl, getPublicUrl } from '@/lib/url';
 *   
 *   // Dashboard URLs
 *   getAppUrl('/settings')     → prod: "https://app.rukny.io/settings"     | dev: "/app/settings"
 *   getAppUrl('/')             → prod: "https://app.rukny.io"              | dev: "/app"
 *   
 *   // Auth URLs  
 *   getAuthUrl('/login')       → prod: "https://accounts.rukny.io/login"    | dev: "/login"
 *   
 *   // Public URLs
 *   getPublicUrl('/ahmad')     → prod: "https://rukny.io/ahmad"             | dev: "/ahmad"
 */

/**
 * Check if we're running in production with subdomain support
 */
function isSubdomainMode(): boolean {
  // Server-side check
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV === 'production' && !!process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  }
  
  // Client-side check
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '0.0.0.0';
}

/**
 * Get the root domain and protocol
 */
function getDomainInfo(): { rootDomain: string; protocol: string } {
  if (typeof window !== 'undefined' && isSubdomainMode()) {
    const host = window.location.hostname;
    const protocol = window.location.protocol.replace(':', '');
    
    // Extract root domain (e.g., "app.rukny.io" → "rukny.io")
    const parts = host.split('.');
    const rootDomain = parts.length > 2 ? parts.slice(-2).join('.') : host;
    
    return { rootDomain, protocol };
  }
  
  return {
    rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'rukny.io',
    protocol: process.env.NODE_ENV === 'production' ? 'https' : 'http',
  };
}

/**
 * Generate a URL for the app dashboard (app.rukny.io)
 * 
 * @param path - Path within the app (e.g., '/settings', '/profile')
 * @returns Full URL in production, relative path in development
 */
export function getAppUrl(path: string = '/'): string {
  const cleanPath = path === '/' ? '' : path.replace(/^\/+/, '/');
  
  if (!isSubdomainMode()) {
    // Development: use path-based routing with /app prefix
    return `/app${cleanPath}`;
  }
  
  // Production on app subdomain: clean URLs without /app prefix
  const { rootDomain, protocol } = getDomainInfo();
  return `${protocol}://app.${rootDomain}${cleanPath}`;
}

/**
 * Generate a URL for auth pages (auth.rukny.io)
 * 
 * @param path - Auth path (e.g., '/login', '/complete-profile')
 * @returns Full URL in production, relative path in development
 */
export function getAuthUrl(path: string = '/login'): string {
  const cleanPath = path.replace(/^\/+/, '/');
  
  if (!isSubdomainMode()) {
    // Development: use path-based routing
    return cleanPath;
  }
  
  // Production: use accounts subdomain
  const { rootDomain, protocol } = getDomainInfo();
  return `${protocol}://accounts.${rootDomain}${cleanPath}`;
}

/**
 * Generate a URL for public pages (rukny.io)
 * 
 * @param path - Public path (e.g., '/ahmad', '/f/my-form')
 * @returns Full URL in production, relative path in development
 */
export function getPublicUrl(path: string = '/'): string {
  const cleanPath = path.replace(/^\/+/, '/');
  
  if (!isSubdomainMode()) {
    // Development: use path-based routing
    return cleanPath;
  }
  
  // Production: use main domain
  const { rootDomain, protocol } = getDomainInfo();
  return `${protocol}://${rootDomain}${cleanPath}`;
}

/**
 * Get the login URL (convenience shortcut)
 */
export function getLoginUrl(callbackUrl?: string): string {
  const params = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : '';
  return getAuthUrl(`/login${params}`);
}

/**
 * Check which subdomain we're currently on
 * Returns 'app', 'auth', or null (main domain / localhost)
 */
export function getCurrentSubdomain(): 'app' | 'accounts' | null {
  if (typeof window === 'undefined') return null;
  
  const host = window.location.hostname;
  
  if (host === 'localhost' || host === '127.0.0.1') return null;
  
  const parts = host.split('.');
  if (parts.length > 2) {
    const sub = parts[0];
    if (sub === 'app') return 'app';
    if (sub === 'accounts') return 'accounts';
  }
  
  return null;
}
