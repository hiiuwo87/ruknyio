import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { S3Service } from '../../../services/s3.service';

/**
 * 🧹 Cleanup Processor
 *
 * معالج مهام التنظيف المجدولة
 */
@Processor('cleanup')
export class CleanupProcessor {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  @Process('expired-sessions')
  async handleExpiredSessions(job: Job) {
    this.logger.log('Starting expired sessions cleanup...');

    const result = await this.prisma.session.deleteMany({
      where: {
        AND: [
          { expiresAt: { lt: new Date() } },
          { refreshExpiresAt: { lt: new Date() } },
        ],
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired sessions`);
    return { deleted: result.count };
  }

  @Process('old-revoked-sessions')
  async handleOldRevokedSessions(job: Job) {
    this.logger.log('Starting old revoked sessions cleanup...');

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await this.prisma.session.deleteMany({
      where: {
        isRevoked: true,
        revokedAt: { lt: ninetyDaysAgo },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old revoked sessions`);
    return { deleted: result.count };
  }

  @Process('temp-files')
  async handleTempFiles(job: Job) {
    this.logger.log('Starting temp files cleanup...');

    const bucket = process.env.S3_BUCKET || '';
    let deleted = 0;

    // حذف الملفات المؤقتة الأقدم من 24 ساعة
    const oneDayAgo = new Date(Date.now() - 86400000);

    const tempFiles = await this.prisma.userFile.findMany({
      where: {
        createdAt: { lt: oneDayAgo },
      },
      select: { id: true, key: true },
    });

    for (const file of tempFiles) {
      try {
        await this.s3Service.deleteObject(bucket, file.key);
        await this.prisma.userFile.delete({ where: { id: file.id } });
        deleted++;
      } catch (error) {
        this.logger.warn(`Failed to delete temp file ${file.key}: ${error.message}`);
      }
    }

    this.logger.log(`Cleaned up ${deleted} temp files`);
    return { deleted };
  }

  @Process('old-security-logs')
  async handleOldSecurityLogs(job: Job<{ daysToKeep?: number }>) {
    const daysToKeep = job.data.daysToKeep || 90;
    this.logger.log(`Starting security logs cleanup (keeping ${daysToKeep} days)...`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.prisma.securityLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old security logs`);
    return { deleted: result.count };
  }

  @Process('expired-verification-codes')
  async handleExpiredVerificationCodes(job: Job) {
    this.logger.log('Starting expired verification codes cleanup...');

    const result = await this.prisma.verification_codes.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired verification codes`);
    return { deleted: result.count };
  }

  @Process('orphaned-files')
  async handleOrphanedFiles(job: Job) {
    this.logger.log('Starting orphaned files cleanup...');

    const bucket = process.env.S3_BUCKET || '';
    let deleted = 0;

    // البحث عن ملفات بدون مستخدم
    const orphanedFiles = await this.prisma.userFile.findMany({
      where: {
        user: null,
      },
      select: { id: true, key: true },
      take: 100,
    });

    for (const file of orphanedFiles) {
      try {
        await this.s3Service.deleteObject(bucket, file.key);
        await this.prisma.userFile.delete({ where: { id: file.id } });
        deleted++;
      } catch (error) {
        this.logger.warn(`Failed to delete orphaned file ${file.key}`);
      }
    }

    this.logger.log(`Cleaned up ${deleted} orphaned files`);
    return { deleted };
  }

  @Process('expired-uploads')
  async handleExpiredUploads(job: Job) {
    this.logger.log('Starting expired chunked uploads cleanup...');

    // هذا يتم عبر ChunkedUploadService
    // يمكن استدعاؤه هنا أيضاً

    return { message: 'Handled by ChunkedUploadService' };
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Cleanup job ${job.name} failed: ${error.message}`,
    );
  }
}
