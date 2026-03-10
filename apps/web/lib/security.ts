/**
 * 🔒 Security Utilities
 * 
 * Provides security-related functions for:
 * - Token sanitization
 * - Error handling
 * - Rate limiting
 */

/**
 * Sanitize a token string to prevent injection attacks
 * Only allows alphanumeric characters, hyphens, and underscores
 */
export function sanitizeToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== 'string') return null;
  
  // Remove any potentially dangerous characters
  // Only allow alphanumeric, hyphens, underscores, and dots (for JWT)
  const sanitized = token.replace(/[^a-zA-Z0-9\-_.]/g, '');
  
  // Check for reasonable token length
  if (sanitized.length < 10 || sanitized.length > 2000) {
    return null;
  }
  
  return sanitized;
}

/**
 * Error handler for consistent error message extraction
 */
export function handleError(error: unknown): { message: string; code?: string } {
  // Handle axios-like errors
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    
    // Check for response.data.message (API errors)
    if (err.response && typeof err.response === 'object') {
      const response = err.response as Record<string, unknown>;
      if (response.data && typeof response.data === 'object') {
        const data = response.data as Record<string, unknown>;
        if (typeof data.message === 'string') {
          return { message: data.message, code: String(data.code || '') };
        }
        if (typeof data.error === 'string') {
          return { message: data.error, code: String(data.code || '') };
        }
      }
    }
    
    // Check for direct message property
    if (typeof err.message === 'string') {
      return { message: err.message };
    }
  }
  
  // Handle Error instances
  if (error instanceof Error) {
    return { message: error.message };
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    return { message: error };
  }
  
  return { message: 'حدث خطأ غير متوقع' };
}

/**
 * Log errors for debugging/monitoring
 */
export function logError(error: unknown, context?: string): void {
  const timestamp = new Date().toISOString();
  const prefix = context ? `[${context}]` : '';
  
  if (error instanceof Error) {
    // Error logged
  } else {
    // Error logged
  }
}

/**
 * Simple in-memory rate limiter for form submissions
 */
interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

class FormRateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts = 5, windowMs = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  check(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    // No entry yet - allow
    if (!entry) {
      this.limits.set(key, { count: 1, firstAttempt: now, lastAttempt: now });
      return { allowed: true, remaining: this.maxAttempts - 1, resetIn: this.windowMs };
    }

    // Window expired - reset
    if (now - entry.firstAttempt > this.windowMs) {
      this.limits.set(key, { count: 1, firstAttempt: now, lastAttempt: now });
      return { allowed: true, remaining: this.maxAttempts - 1, resetIn: this.windowMs };
    }

    // Within window - check count
    if (entry.count >= this.maxAttempts) {
      const resetIn = this.windowMs - (now - entry.firstAttempt);
      return { allowed: false, remaining: 0, resetIn };
    }

    // Increment count
    entry.count++;
    entry.lastAttempt = now;
    this.limits.set(key, entry);

    return {
      allowed: true,
      remaining: this.maxAttempts - entry.count,
      resetIn: this.windowMs - (now - entry.firstAttempt),
    };
  }

  reset(key: string): void {
    this.limits.delete(key);
  }
}

export const formLimiter = new FormRateLimiter(10, 60000); // 10 attempts per minute
