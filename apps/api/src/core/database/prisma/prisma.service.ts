import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import { DB_PERFORMANCE } from '../database.constants';

/**
 * ⚡ Extended Prisma Client with performance optimizations for Neon PostgreSQL
 * 
 * Features:
 * - Connection pooling for Neon PostgreSQL (serverless)
 * - Automatic reconnection on connection errors (handles Neon suspend/resume)
 * - Query performance monitoring
 * - Handles "connection closed" errors gracefully
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private queryCount = 0;
  private slowQueryCount = 0;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  constructor() {
    // ⚠️ Validate DATABASE_URL exists before initializing
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        '❌ DATABASE_URL environment variable is not defined. ' +
        'Please ensure it is set in your Railway environment variables. ' +
        'Expected format: postgresql://user:password@host:port/database?sslmode=require'
      );
    }

    // Prisma 7: engine type "client" requires adapter (or accelerateUrl)
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    super({
      adapter,
      log: [
        // ⚡ Performance: Log slow queries in development
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });

    // ⚡ Query performance monitoring with improved thresholds
    // @ts-ignore - Prisma event typing
    this.$on('query', (e: Prisma.QueryEvent) => {
      this.queryCount++;

      // Track critical slow queries separately
      if (e.duration > DB_PERFORMANCE.CRITICAL_SLOW_QUERY_THRESHOLD) {
        this.slowQueryCount++;
        this.logger.error(
          `🔴 CRITICAL SLOW QUERY (${e.duration}ms): ${e.query.substring(0, 150)}...`,
        );
      } else if (e.duration > DB_PERFORMANCE.VERY_SLOW_QUERY_THRESHOLD) {
        this.slowQueryCount++;
        this.logger.error(
          `🔴 Very Slow Query (${e.duration}ms): ${e.query.substring(0, 150)}...`,
        );
      } else if (
        e.duration > DB_PERFORMANCE.SLOW_QUERY_THRESHOLD &&
        process.env.NODE_ENV !== 'production'
      ) {
        this.logger.warn(`⚠️ Slow Query (${e.duration}ms): ${e.query.substring(0, 150)}...`);
      }
    });
  }

  async onModuleInit() {
    const startTime = Date.now();
    await this.connectWithRetry();
    const duration = Date.now() - startTime;
    this.logger.log(`✅ Database connected successfully (${duration}ms)`);
    
    // ⚡ Start keepalive ping for Neon (prevents auto-suspend during active use)
    this.startKeepalive();
    
    // ⚡ Connection warming: Pre-warm common table queries for auth/refresh
    // This helps reduce cold start latency on first real request
    if (process.env.NODE_ENV === 'production') {
      this.warmConnectionPool().catch(err => {
        this.logger.warn(`Connection warming failed (non-critical): ${err.message}`);
      });
    }
  }
  
  /**
   * ⚡ Warm up connection pool with common queries
   * Executes lightweight queries on frequently accessed tables
   * to prime the query planner and connection pool
   */
  private async warmConnectionPool(): Promise<void> {
    const warmupStart = Date.now();
    try {
      // Run warmup queries in parallel for efficiency
      await Promise.all([
        // Session table (used in token refresh)
        this.$queryRaw`SELECT 1 FROM "sessions" LIMIT 1`,
        // User table (used in auth)
        this.$queryRaw`SELECT 1 FROM "users" LIMIT 1`,
      ]);
      
      const warmupDuration = Date.now() - warmupStart;
      this.logger.log(`⚡ Connection pool warmed up (${warmupDuration}ms)`);
    } catch {
      // Tables might not exist yet (first deployment), ignore
    }
  }

  /**
   * ⚡ Keepalive ping to prevent Neon from suspending during active sessions
   * Runs every 90 seconds (Neon suspends after 5 minutes of inactivity)
   * 
   * ⚡ Changed from 3 minutes to 90 seconds for better responsiveness
   */
  private keepaliveInterval: NodeJS.Timeout | null = null;
  
  private startKeepalive(): void {
    // Only in production
    if (process.env.NODE_ENV !== 'production') return;
    
    this.keepaliveInterval = setInterval(async () => {
      try {
        // Timeout the keepalive ping to prevent blocking other queries
        // If it takes more than 5 seconds, we have a serious connection issue
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Keepalive timeout')), 5000)
        );
        
        const startTime = Date.now();
        await Promise.race([
          this.$queryRaw`SELECT 1`,
          timeoutPromise
        ]);
        const duration = Date.now() - startTime;
        
        this.logger.debug(`🔄 Database keepalive ping successful (${duration}ms)`);
        // If keepalive is slow, log it to diagnose connection issues
        if (duration > 1000) {
          this.logger.warn(
            `⚠️ Slow keepalive ping (${duration}ms) - may indicate database performance issues`,
          );
        }
      } catch (error) {
        this.logger.warn('⚠️ Keepalive ping failed, will reconnect on next query');
        this.isConnected = false;
      }
    }, 90 * 1000); // ⚡ 90 seconds (reduced from 3 minutes) for better Neon responsiveness
  }

  /**
   * ⚡ Connect with retry logic for Neon PostgreSQL
   * Handles connection pool timeouts and serverless cold starts
   */
  private async connectWithRetry(maxRetries = 5, delayMs = 2000): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.isConnected = true;
        this.reconnectAttempts = 0;
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isNeonColdStart = errorMessage.includes('Closed') || 
                                errorMessage.includes('connection') ||
                                errorMessage.includes('timeout');
        
        this.logger.warn(
          `Database connection attempt ${attempt}/${maxRetries} failed: ${errorMessage}` +
          (isNeonColdStart ? ' (Neon cold start detected)' : ''),
        );
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff with jitter for Neon cold starts
        const backoffDelay = delayMs * Math.pow(1.5, attempt - 1) + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      }
    }
  }

  /**
   * ⚡ Ensure connection is alive, reconnect if needed
   * Call this before critical operations after long idle periods
   */
  async ensureConnection(): Promise<void> {
    try {
      await this.$queryRaw`SELECT 1`;
      this.isConnected = true;
    } catch (error) {
      this.logger.warn('Connection lost, attempting to reconnect...');
      this.isConnected = false;
      await this.connectWithRetry();
    }
  }

  /**
   * ⚡ Execute query with automatic retry on connection errors
   * Handles Neon's "connection closed" errors gracefully
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isConnectionError = 
          errorMessage.includes('Closed') ||
          errorMessage.includes('connection') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ETIMEDOUT');

        if (!isConnectionError || attempt === maxRetries) {
          throw error;
        }

        this.logger.warn(
          `Query failed (attempt ${attempt}/${maxRetries}): ${errorMessage}. Reconnecting...`,
        );
        
        // Reconnect before retry
        this.isConnected = false;
        await this.connectWithRetry(2, 1000);
        
        // Small delay before retry
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  async onModuleDestroy() {
    // Stop keepalive
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
    }
    
    await this.$disconnect();
    this.logger.log('🔌 Database disconnected');
  }

  /**
   * ⚡ Get database health status
   */
  async getHealthStatus(): Promise<{
    connected: boolean;
    responseTime: number;
    queryCount: number;
    slowQueryCount: number;
    poolInfo?: any;
  }> {
    const startTime = Date.now();
    let connected = false;

    try {
      // Simple query to test connection
      await this.$queryRaw`SELECT 1`;
      connected = true;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
    }

    const responseTime = Date.now() - startTime;

    return {
      connected,
      responseTime,
      queryCount: this.queryCount,
      slowQueryCount: this.slowQueryCount,
    };
  }

  /**
   * ⚡ Reset query counters (useful for monitoring)
   */
  resetQueryCounters(): void {
    this.queryCount = 0;
    this.slowQueryCount = 0;
  }

  /**
   * ⚡ Execute raw query with timeout
   */
  async executeWithTimeout<T>(
    query: () => Promise<T>,
    timeoutMs: number = DB_PERFORMANCE.SLOW_QUERY_THRESHOLD * 2,
  ): Promise<T> {
    return Promise.race([
      query(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  }

  /**
   * ⚡ Soft delete helper - marks record as deleted without removing
   */
  async softDelete<T extends { deletedAt?: Date | null }>(
    model: any,
    where: any,
  ): Promise<T> {
    return model.update({
      where,
      data: { deletedAt: new Date() },
    });
  }

  /**
   * ⚡ Batch operations helper - processes in chunks to avoid timeouts
   */
  async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 100,
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processor));
      results.push(...batchResults);

      // Small delay between batches to prevent overwhelming the DB
      if (i + batchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    return results;
  }
}
