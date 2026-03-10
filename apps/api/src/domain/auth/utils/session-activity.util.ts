/**
 * ⚡ Session Activity Utility
 *
 * In-memory throttling for lastActivity updates to prevent:
 * - Concurrent DB writes causing slow queries (770ms+)
 * - Database contention on high-traffic sessions
 *
 * How it works:
 * 1. Tracks last update time per session in memory
 * 2. Only allows one update per THROTTLE_INTERVAL
 * 3. Cleans up old entries automatically
 */

import { PrismaService } from '../../../core/database/prisma/prisma.service';

// In-memory throttle map: sessionId -> last update timestamp
const lastActivityCache = new Map<string, number>();

// Update interval: 2 minutes
const THROTTLE_INTERVAL_MS = 120_000;

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  const expiry = THROTTLE_INTERVAL_MS * 2;

  for (const [sessionId, timestamp] of lastActivityCache.entries()) {
    if (now - timestamp > expiry) {
      lastActivityCache.delete(sessionId);
    }
  }
}, 600_000);

/**
 * Update session lastActivity with in-memory throttling
 *
 * @param prisma - PrismaService instance
 * @param sessionId - Session ID to update
 * @returns true if update was triggered, false if throttled
 */
export function updateSessionActivityThrottled(
  prisma: PrismaService,
  sessionId: string,
): boolean {
  const now = Date.now();
  const lastUpdate = lastActivityCache.get(sessionId) || 0;

  // Throttle: skip if updated recently
  if (now - lastUpdate < THROTTLE_INTERVAL_MS) {
    return false;
  }

  // Set cache FIRST to prevent concurrent updates
  lastActivityCache.set(sessionId, now);

  // Fire-and-forget async update
  prisma.$executeRaw`
    UPDATE sessions 
    SET "lastActivity" = NOW() 
    WHERE id = ${sessionId}
  `.catch(() => {
    // On error, remove from cache so next request can retry
    lastActivityCache.delete(sessionId);
  });

  return true;
}

/**
 * Check if session activity update is needed
 * Useful for checking before making decisions
 */
export function shouldUpdateSessionActivity(sessionId: string): boolean {
  const now = Date.now();
  const lastUpdate = lastActivityCache.get(sessionId) || 0;
  return now - lastUpdate >= THROTTLE_INTERVAL_MS;
}

/**
 * Clear session from cache (e.g., on logout)
 */
export function clearSessionActivityCache(sessionId: string): void {
  lastActivityCache.delete(sessionId);
}
