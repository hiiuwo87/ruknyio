/**
 * ⚡ Database Constants - Centralized database configuration
 */

// ===== Connection Pool Settings =====
export const DB_POOL = {
  /**
   * Maximum number of connections in the pool
   * Recommended: (CPU cores * 2) + effective_spindle_count
   * For most apps: 10-20 connections
   * For high traffic: 20-50 connections
   * Use lower for serverless/Neon to avoid exhausting compute resources
   */
  CONNECTION_LIMIT: process.env.NODE_ENV === 'production' ? 15 : 10,

  /**
   * Maximum time (ms) to wait for a connection from the pool
   * If exceeded, throws an error
   */
  POOL_TIMEOUT: process.env.NODE_ENV === 'production' ? 15000 : 20000,

  /**
   * Connection timeout (ms)
   * Time to wait for initial connection establishment
   */
  CONNECT_TIMEOUT: process.env.NODE_ENV === 'production' ? 15000 : 30000,

  /**
   * Idle timeout (ms)
   * Close connections that have been idle for this long
   * Lower value for serverless to reduce resource consumption
   */
  IDLE_TIMEOUT: 45000, // 45 seconds (reduced from 60s for Neon)

  /**
   * Statement timeout (ms)
   * Maximum time a query can run before being cancelled
   * Prevents slow queries from holding locks
   */
  STATEMENT_TIMEOUT: process.env.NODE_ENV === 'production' ? 45000 : 60000,

  /**
   * Connection max lifetime (ms)
   * Force reconnect after this duration to prevent stale connections
   * Useful for Neon which may forcefully close connections
   */
  MAX_LIFETIME: 30 * 60 * 1000, // 30 minutes

  /**
   * Enable PgBouncer mode for connection pooling
   * Critical for serverless/Neon deployments
   */
  PGBOUNCER_MODE: true,
} as const;

// ===== Query Timeout Settings =====
export const QUERY_TIMEOUTS = {
  /**
   * Default timeout for normal CRUD operations
   * Most queries should complete well under this
   */
  DEFAULT: 10000, // 10 seconds

  /**
   * Fast timeout for simple lookups
   * Use for single-row fetches, existence checks
   */
  FAST: 5000, // 5 seconds

  /**
   * Extended timeout for complex queries
   * Use for aggregations, joins, analytics
   */
  COMPLEX: 20000, // 20 seconds

  /**
   * Report timeout for export/report generation
   * Only use for explicitly requested reports
   */
  REPORT: 60000, // 60 seconds

  /**
   * Maintenance timeout for cleanup, migrations
   * Only for internal maintenance tasks
   */
  MAINTENANCE: 300000, // 5 minutes

  /**
   * Image processing timeout
   * For sharp/imagemagick operations
   */
  IMAGE_PROCESSING: 30000, // 30 seconds
} as const;

// ===== Cleanup Settings =====
export const DB_CLEANUP = {
  /**
   * How often to run cleanup jobs (in ms)
   */
  INTERVAL: 60 * 60 * 1000, // Every hour

  /**
   * Retention periods for various tables (in days)
   */
  RETENTION: {
    SECURITY_LOGS: 90, // 3 months
    LOGIN_ATTEMPTS: 30, // 1 month
    EXPIRED_SESSIONS: 0, // Immediately
    EXPIRED_OTP: 1, // 1 day
    WEBHOOK_LOGS: 30, // 1 month
    FORM_ANALYTICS: 365, // 1 year
    PENDING_2FA: 1, // 1 day
  },

  /**
   * Batch size for deletion (to avoid locking)
   * Lower batch size for serverless to reduce transaction duration
   */
  BATCH_SIZE: 500,
} as const;

// ===== Query Performance Thresholds =====
export const DB_PERFORMANCE = {
  /**
   * Slow query threshold (ms)
   * Queries slower than this will be logged
   * Increased threshold for serverless due to network latency
   */
  SLOW_QUERY_THRESHOLD: process.env.NODE_ENV === 'production' ? 250 : 2000,

  /**
   * Very slow query threshold (ms)
   * Queries slower than this will trigger warnings
   * Indicates potential performance issues
   */
  VERY_SLOW_QUERY_THRESHOLD: process.env.NODE_ENV === 'production' ? 1000 : 5000,

  /**
   * Critical slow query threshold (ms)
   * Queries slower than this need immediate attention
   */
  CRITICAL_SLOW_QUERY_THRESHOLD: process.env.NODE_ENV === 'production' ? 5000 : 15000,

  /**
   * Maximum results per page for pagination
   */
  MAX_PAGE_SIZE: 100,

  /**
   * Default results per page
   */
  DEFAULT_PAGE_SIZE: 20,
} as const;

/**
 * Build optimized DATABASE_URL with connection pool parameters
 * @param baseUrl - Base database URL without parameters
 */
export function buildDatabaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);

  // Add connection pool parameters optimized for Neon
  url.searchParams.set('connection_limit', String(DB_POOL.CONNECTION_LIMIT));
  url.searchParams.set('pool_timeout', String(DB_POOL.POOL_TIMEOUT / 1000)); // Convert to seconds
  url.searchParams.set('connect_timeout', String(DB_POOL.CONNECT_TIMEOUT / 1000));
  url.searchParams.set('statement_timeout', String(DB_POOL.STATEMENT_TIMEOUT));
  url.searchParams.set('max_lifetime', String(DB_POOL.MAX_LIFETIME / 1000));

  // PostgreSQL specific optimizations
  if (DB_POOL.PGBOUNCER_MODE) {
    url.searchParams.set('pgbouncer', 'true'); // Enable PgBouncer compatibility
  }
  url.searchParams.set('sslmode', 'require'); // Require SSL for security

  return url.toString();
}
