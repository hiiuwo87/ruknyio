import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from '../cache/redis.service';
import { DB_CLEANUP } from './database.constants';

/**
 * ⚡ Database Cleanup Service
 * Automatically cleans up old/expired data to keep the database performant
 * 
 * Features:
 * - Distributed locking for multi-instance safety
 * - Batch deletion to avoid long transactions
 * - Configurable retention periods
 */
@Injectable()
export class DatabaseCleanupService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseCleanupService.name);
  private readonly LOCK_KEY = 'db:cleanup:lock';
  private readonly LOCK_TTL = 3600; // 1 hour
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    // Skip initial cleanup if disabled
    if (process.env.ENABLE_CLEANUP_CRON === 'false') {
      this.logger.log('Cleanup service disabled via ENABLE_CLEANUP_CRON=false');
      return;
    }

    // Run initial cleanup on startup (delayed to not block startup)
    setTimeout(() => {
      this.runAllCleanups().catch((err) => {
        this.logger.warn('Initial cleanup failed (this is non-critical):', err instanceof Error ? err.message : err);
      });
    }, 30000); // 30 seconds after startup
  }

  /**
   * ⚡ Check if database is reachable before running cleanup
   */
  private async isDatabaseReachable(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.warn(
        `Database unreachable: ${error instanceof Error ? error.message : 'Unknown error'}. Cleanup skipped.`,
      );
      return false;
    }
  }

  /**
   * ⚡ Run all cleanup jobs every hour
   * Uses distributed lock to prevent multiple instances from running simultaneously
   * Gracefully handles database connectivity issues
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runAllCleanups(): Promise<void> {
    // Skip if disabled
    if (process.env.ENABLE_CLEANUP_CRON === 'false') {
      return;
    }

    // Local guard
    if (this.isRunning) {
      this.logger.warn('Cleanup already running locally, skipping...');
      return;
    }

    // Check database connectivity before attempting cleanup
    const isDbReachable = await this.isDatabaseReachable();
    if (!isDbReachable) {
      this.logger.warn(
        '⚠️ Database is currently unreachable. Cleanup will retry in the next cycle.',
      );
      return;
    }

    // Try to acquire distributed lock
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      this.logger.log('🔒 Another instance is running cleanup, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    this.logger.log('🧹 Starting database cleanup...');

    try {
      const results = await Promise.allSettled([
        this.cleanupExpiredSessions(),
        this.cleanupExpiredOTPs(),
        this.cleanupOldSecurityLogs(),
        this.cleanupOldLoginAttempts(),
        this.cleanupExpiredPending2FA(),
        this.cleanupOldWebhookLogs(),
        this.cleanupExpiredVerificationCodes(),
        this.cleanupExpiredQuickSignLinks(),
      ]);

      // Log results
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failCount = results.filter((r) => r.status === 'rejected').length;

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const error = result.reason;
          // Check if it's a connection error
          if (
            error?.code === 'P1001' ||
            error?.message?.includes('Can\'t reach database server')
          ) {
            this.logger.warn(
              `Cleanup task ${index} skipped: Database temporarily unreachable. This is non-critical and will retry in the next cycle.`,
            );
          } else {
            this.logger.error(`Cleanup task ${index} failed:`, error);
          }
        }
      });

      const duration = Date.now() - startTime;
      if (failCount === 0) {
        this.logger.log(
          `✅ Database cleanup completed in ${duration}ms (${successCount} successful)`,
        );
      } else {
        this.logger.warn(
          `✅ Database cleanup completed in ${duration}ms (${successCount} successful, ${failCount} skipped/failed)`,
        );
      }
    } catch (error) {
      const err = error as any;
      if (err?.code === 'P1001' || err?.message?.includes('Can\'t reach database server')) {
        this.logger.warn(
          '⚠️ Database cleanup skipped: Database is currently unreachable. Will retry in the next cycle.',
        );
      } else {
        this.logger.error('Database cleanup failed:', error);
      }
    } finally {
      this.isRunning = false;
      // Release the distributed lock
      await this.releaseLock();
    }
  }

  // ===== Distributed Lock Methods =====

  /**
   * ⚡ Acquire distributed lock using Redis
   * Returns true if lock was acquired, false if another instance holds it
   */
  private async acquireLock(): Promise<boolean> {
    try {
      const instanceId = process.env.HOSTNAME || process.env.POD_NAME || `instance-${process.pid}`;
      
      // Try to set the lock with NX (only if not exists)
      const lockValue = `${instanceId}:${Date.now()}`;
      await this.redis.set(this.LOCK_KEY, lockValue, this.LOCK_TTL);
      
      // Verify we got the lock
      const currentValue = await this.redis.get<string>(this.LOCK_KEY);
      return currentValue === lockValue;
    } catch (error) {
      this.logger.warn('Failed to acquire distributed lock, proceeding anyway:', error);
      // If Redis is down, allow cleanup to run (single instance fallback)
      return true;
    }
  }

  /**
   * ⚡ Release the distributed lock
   */
  private async releaseLock(): Promise<void> {
    try {
      await this.redis.del(this.LOCK_KEY);
    } catch (error) {
      this.logger.warn('Failed to release distributed lock:', error);
    }
  }

  // ===== Cleanup Methods =====

  /**
   * ⚡ Clean up expired sessions
   *
   * ⚠️ نَحذف فقط عندما تنتهي صلاحية refresh token (refreshExpiresAt)، وليس expiresAt (30 دقيقة).
   * لو حذفنا عند انتهاء expiresAt، المستخدم يبقى عنده كوكي refresh صالح 14 يوم لكن الجلسة
   * انمسحت من DB → "Session not found" وتسجيل خروج غير متوقع.
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const now = new Date();
      const result = await this.prisma.session.deleteMany({
        where: {
          OR: [
            // جلسات انتهت صلاحية refresh token (14 يوم)
            { refreshExpiresAt: { lt: now } },
            // جلسات مُبطلة قديمة (أكثر من 7 أيام)
            {
              isRevoked: true,
              revokedAt: { lt: this.daysAgo(7) } },
          ],
        },
      });

      if (result.count > 0) {
        this.logger.debug(`Cleaned up ${result.count} expired sessions`);
      }
      return result.count;
    } catch (error) {
      this.handleCleanupError('cleanupExpiredSessions', error);
      return 0;
    }
  }

  /**
   * ⚡ Clean up expired OTPs (WhatsApp)
   */
  async cleanupExpiredOTPs(): Promise<number> {
    try {
      const cutoff = this.daysAgo(DB_CLEANUP.RETENTION.EXPIRED_OTP);

      const result = await this.prisma.whatsappOtp.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: new Date() } }, { verified: true, createdAt: { lt: cutoff } }],
        },
      });

      if (result.count > 0) {
        this.logger.debug(`Cleaned up ${result.count} expired OTPs`);
      }
      return result.count;
    } catch (error) {
      this.handleCleanupError('cleanupExpiredOTPs', error);
      return 0;
    }
  }

  /**
   * ⚡ Clean up old security logs
   */
  async cleanupOldSecurityLogs(): Promise<number> {
    try {
      const cutoff = this.daysAgo(DB_CLEANUP.RETENTION.SECURITY_LOGS);

      // Delete in batches to avoid long-running transactions
      let totalDeleted = 0;
      let deleted = 0;

      do {
        const result = await this.prisma.securityLog.deleteMany({
          where: {
            createdAt: { lt: cutoff },
          },
        });
        deleted = result.count;
        totalDeleted += deleted;

        // Small delay between batches
        if (deleted > 0) {
          await this.sleep(100);
        }
      } while (deleted >= DB_CLEANUP.BATCH_SIZE);

      if (totalDeleted > 0) {
        this.logger.debug(`Cleaned up ${totalDeleted} old security logs`);
      }
      return totalDeleted;
    } catch (error) {
      this.handleCleanupError('cleanupOldSecurityLogs', error);
      return 0;
    }
  }

  /**
   * ⚡ Clean up old login attempts
   */
  async cleanupOldLoginAttempts(): Promise<number> {
    try {
      const cutoff = this.daysAgo(DB_CLEANUP.RETENTION.LOGIN_ATTEMPTS);

      const result = await this.prisma.loginAttempt.deleteMany({
        where: {
          createdAt: { lt: cutoff },
        },
      });

      if (result.count > 0) {
        this.logger.debug(`Cleaned up ${result.count} old login attempts`);
      }
      return result.count;
    } catch (error) {
      this.handleCleanupError('cleanupOldLoginAttempts', error);
      return 0;
    }
  }

  /**
   * ⚡ Clean up expired pending 2FA sessions
   */
  async cleanupExpiredPending2FA(): Promise<number> {
    try {
      const result = await this.prisma.pendingTwoFactorSession.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      if (result.count > 0) {
        this.logger.debug(`Cleaned up ${result.count} expired 2FA sessions`);
      }
      return result.count;
    } catch (error) {
      this.handleCleanupError('cleanupExpiredPending2FA', error);
      return 0;
    }
  }

  /**
   * ⚡ Clean up old webhook logs
   */
  async cleanupOldWebhookLogs(): Promise<number> {
    try {
      const cutoff = this.daysAgo(DB_CLEANUP.RETENTION.WEBHOOK_LOGS);

      const result = await this.prisma.telegramWebhookLog.deleteMany({
        where: {
          createdAt: { lt: cutoff },
        },
      });

      if (result.count > 0) {
        this.logger.debug(`Cleaned up ${result.count} old webhook logs`);
      }
      return result.count;
    } catch (error) {
      this.handleCleanupError('cleanupOldWebhookLogs', error);
      return 0;
    }
  }

  /**
   * ⚡ Clean up expired verification codes
   */
  async cleanupExpiredVerificationCodes(): Promise<number> {
    try {
      const result = await this.prisma.verification_codes.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: new Date() } }, { verified: true, verifiedAt: { lt: this.daysAgo(1) } }],
        },
      });

      if (result.count > 0) {
        this.logger.debug(`Cleaned up ${result.count} expired verification codes`);
      }
      return result.count;
    } catch (error) {
      this.handleCleanupError('cleanupExpiredVerificationCodes', error);
      return 0;
    }
  }

  /**
   * ⚡ Clean up expired QuickSign links
   */
  async cleanupExpiredQuickSignLinks(): Promise<number> {
    try {
      const result = await this.prisma.quicksign_links.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { used: true, usedAt: { lt: this.daysAgo(7) } },
          ],
        },
      });

      if (result.count > 0) {
        this.logger.debug(`Cleaned up ${result.count} expired QuickSign links`);
      }
      return result.count;
    } catch (error) {
      this.handleCleanupError('cleanupExpiredQuickSignLinks', error);
      return 0;
    }
  }

  /**
   * ⚡ Clean up old IP lockouts
   */
  async cleanupExpiredIPLockouts(): Promise<number> {
    const result = await this.prisma.iPLockout.deleteMany({
      where: {
        lockedUntil: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      this.logger.debug(`Cleaned up ${result.count} expired IP lockouts`);
    }
    return result.count;
  }

  /**
   * ⚡ Clean up old account lockouts
   */
  async cleanupExpiredAccountLockouts(): Promise<number> {
    const result = await this.prisma.accountLockout.deleteMany({
      where: {
        lockedUntil: { lt: new Date() },
        lockCount: 0,
      },
    });

    if (result.count > 0) {
      this.logger.debug(`Cleaned up ${result.count} expired account lockouts`);
    }
    return result.count;
  }

  /**
   * ⚡ Get cleanup statistics
   */
  async getCleanupStats(): Promise<{
    expiredSessions: number;
    expiredOTPs: number;
    oldSecurityLogs: number;
    oldLoginAttempts: number;
    expiredPending2FA: number;
  }> {
    const now = new Date();
    const [expiredSessions, expiredOTPs, oldSecurityLogs, oldLoginAttempts, expiredPending2FA] =
      await Promise.all([
        this.prisma.session.count({
          where: { OR: [{ expiresAt: { lt: now } }, { isRevoked: true }] },
        }),
        this.prisma.whatsappOtp.count({
          where: { expiresAt: { lt: now } },
        }),
        this.prisma.securityLog.count({
          where: { createdAt: { lt: this.daysAgo(DB_CLEANUP.RETENTION.SECURITY_LOGS) } },
        }),
        this.prisma.loginAttempt.count({
          where: { createdAt: { lt: this.daysAgo(DB_CLEANUP.RETENTION.LOGIN_ATTEMPTS) } },
        }),
        this.prisma.pendingTwoFactorSession.count({
          where: { expiresAt: { lt: now } },
        }),
      ]);

    return {
      expiredSessions,
      expiredOTPs,
      oldSecurityLogs,
      oldLoginAttempts,
      expiredPending2FA,
    };
  }

  // ===== Helper Methods =====

  /**
   * ⚡ Handle cleanup errors gracefully
   * Distinguishes between critical errors and temporary connectivity issues
   */
  private handleCleanupError(taskName: string, error: any): void {
    // Check if it's a database connection error
    if (
      error?.code === 'P1001' ||
      error?.message?.includes('Can\'t reach database server') ||
      error?.message?.includes('ECONNREFUSED') ||
      error?.message?.includes('ETIMEDOUT')
    ) {
      this.logger.warn(
        `⚠️ ${taskName}: Database temporarily unreachable (non-critical). Will retry in next cycle.`,
      );
    } else if (error?.code?.startsWith('P')) {
      // Other Prisma errors
      this.logger.warn(`${taskName}: Prisma error ${error.code}: ${error.message}`);
    } else {
      // Unexpected errors
      this.logger.error(`${taskName}: Unexpected error:`, error);
    }
  }

  private daysAgo(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
