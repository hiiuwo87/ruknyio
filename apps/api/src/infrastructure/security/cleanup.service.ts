import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { IpVerificationService } from '../../domain/auth/ip-verification.service';

/**
 * 🔒 Security Cleanup Service
 *
 * Scheduled jobs for cleaning up expired/old security-related data:
 * - Expired sessions
 * - Expired verification codes
 * - Old login attempts
 * - Revoked sessions older than 90 days
 */
@Injectable()
export class SecurityCleanupService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private ipVerificationService: IpVerificationService,
  ) {}

  onModuleInit() {
    console.log('🧹 Security cleanup service initialized');
  }

  /**
   * Clean up expired sessions daily at 2 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredSessions() {
    console.log('🧹 Running session cleanup...');

    try {
      // Delete sessions where both tokens are expired
      const result = await this.prisma.session.deleteMany({
        where: {
          AND: [
            {
              expiresAt: {
                lt: new Date(),
              },
            },
            {
              refreshExpiresAt: {
                lt: new Date(),
              },
            },
          ],
        },
      });

      console.log(`✅ Cleaned up ${result.count} expired sessions`);
      return result.count;
    } catch (error) {
      console.error('❌ Session cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Clean up old revoked sessions (older than 90 days)
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldRevokedSessions() {
    console.log('🧹 Running old revoked sessions cleanup...');

    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const result = await this.prisma.session.deleteMany({
        where: {
          isRevoked: true,
          revokedAt: {
            lt: ninetyDaysAgo,
          },
        },
      });

      console.log(`✅ Cleaned up ${result.count} old revoked sessions`);
      return result.count;
    } catch (error) {
      console.error('❌ Revoked sessions cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Clean up expired verification codes daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredVerificationCodes() {
    console.log('🧹 Running verification codes cleanup...');

    try {
      const count = await this.ipVerificationService.cleanupExpiredCodes();
      console.log(`✅ Cleaned up ${count} expired verification codes`);
      return count;
    } catch (error) {
      console.error('❌ Verification codes cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Clean up old login attempts (older than 30 days)
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldLoginAttempts() {
    console.log('🧹 Running login attempts cleanup...');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await this.prisma.loginAttempt.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      console.log(`✅ Cleaned up ${result.count} old login attempts`);
      return result.count;
    } catch (error) {
      console.error('❌ Login attempts cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Clean up old security logs (older than 180 days)
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async cleanupOldSecurityLogs() {
    console.log('🧹 Running security logs cleanup...');

    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

      const result = await this.prisma.securityLog.deleteMany({
        where: {
          createdAt: {
            lt: sixMonthsAgo,
          },
          // Keep WARNING and ERROR logs longer
          status: {
            equals: 'SUCCESS',
          },
        },
      });

      console.log(`✅ Cleaned up ${result.count} old security logs`);
      return result.count;
    } catch (error) {
      console.error('❌ Security logs cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Manual cleanup trigger (for admin use)
   */
  async runAllCleanups(): Promise<{
    sessions: number;
    revokedSessions: number;
    verificationCodes: number;
    loginAttempts: number;
    securityLogs: number;
  }> {
    return {
      sessions: await this.cleanupExpiredSessions(),
      revokedSessions: await this.cleanupOldRevokedSessions(),
      verificationCodes: await this.cleanupExpiredVerificationCodes(),
      loginAttempts: await this.cleanupOldLoginAttempts(),
      securityLogs: await this.cleanupOldSecurityLogs(),
    };
  }
}
