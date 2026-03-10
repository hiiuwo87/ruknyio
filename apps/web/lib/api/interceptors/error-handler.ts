/**
 * 🛡️ API Error Interceptor
 * 
 * Centralized error handling for API requests
 * - Classifies errors
 * - Logs appropriately
 * - Returns user-safe messages
 */

import { classifyError, logError, type ClassifiedError } from '@/lib/security/errors';

/**
 * Process API error and return classified error with user message
 */
export function handleApiError(
  error: unknown,
  statusCode?: number
): ClassifiedError {
  const classified = classifyError(error, statusCode);
  logError(classified);
  return classified;
}

/**
 * Extract user-safe message from any error
 */
export function getUserErrorMessage(error: unknown, fallback: string = 'حدث خطأ'): string {
  try {
    const classified = classifyError(error);
    return classified.userMessage || fallback;
  } catch {
    return fallback;
  }
}
