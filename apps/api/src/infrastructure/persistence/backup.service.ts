import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { S3Service } from '../../services/s3.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface BackupInfo {
  id: string;
  timestamp: Date;
  size: number;
  type: 'full' | 'incremental';
  tables: string[];
  status: 'completed' | 'failed' | 'in_progress';
  s3Key?: string;
}

/**
 * 💾 Backup Service
 *
 * نظام النسخ الاحتياطي للبيانات
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly BACKUP_PREFIX = 'backups/';
  private readonly bucket = process.env.S3_BUCKET || 'rukny-backups';
  private activeBackup: BackupInfo | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  /**
   * إنشاء نسخة احتياطية كاملة
   */
  async createFullBackup(): Promise<BackupInfo> {
    const backupId = `backup_${Date.now()}`;
    const timestamp = new Date();

    this.activeBackup = {
      id: backupId,
      timestamp,
      size: 0,
      type: 'full',
      tables: [],
      status: 'in_progress',
    };

    try {
      this.logger.log(`Starting full backup: ${backupId}`);

      // جلب قائمة الجداول
      const tables = await this.getTableNames();
      this.activeBackup.tables = tables;

      const backupData: Record<string, any[]> = {};
      let totalSize = 0;

      // نسخ كل جدول
      for (const table of tables) {
        const data = await this.exportTable(table);
        backupData[table] = data;
        totalSize += JSON.stringify(data).length;
        this.logger.debug(`Backed up ${table}: ${data.length} records`);
      }

      // ضغط البيانات
      const jsonData = JSON.stringify({
        id: backupId,
        timestamp: timestamp.toISOString(),
        type: 'full',
        tables,
        data: backupData,
      });

      const compressed = await gzip(jsonData);

      // رفع إلى S3
      const s3Key = `${this.BACKUP_PREFIX}${backupId}.json.gz`;
      await this.s3.uploadBuffer(this.bucket, s3Key, compressed, 'application/gzip');

      this.activeBackup.size = compressed.length;
      this.activeBackup.s3Key = s3Key;
      this.activeBackup.status = 'completed';

      this.logger.log(
        `Backup completed: ${backupId}, Size: ${this.formatSize(compressed.length)}`,
      );

      // حفظ معلومات النسخة في قاعدة البيانات
      await this.saveBackupRecord(this.activeBackup);

      return this.activeBackup;
    } catch (error) {
      this.logger.error(`Backup failed: ${error.message}`);
      this.activeBackup.status = 'failed';
      throw error;
    }
  }

  /**
   * استعادة من نسخة احتياطية
   */
  async restoreBackup(backupId: string): Promise<{ restored: string[] }> {
    this.logger.log(`Starting restore from backup: ${backupId}`);

    try {
      // جلب النسخة من S3
      const s3Key = `${this.BACKUP_PREFIX}${backupId}.json.gz`;
      const compressed = await this.s3.getObject(this.bucket, s3Key);
      const jsonData = await gunzip(compressed);
      const backup = JSON.parse(jsonData.toString());

      const restored: string[] = [];

      // استعادة كل جدول
      for (const [table, data] of Object.entries(backup.data)) {
        await this.importTable(table, data as any[]);
        restored.push(table);
        this.logger.debug(`Restored ${table}: ${(data as any[]).length} records`);
      }

      this.logger.log(`Restore completed from ${backupId}`);
      return { restored };
    } catch (error) {
      this.logger.error(`Restore failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * الحصول على قائمة النسخ الاحتياطية
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      // جلب من قاعدة البيانات إذا كان هناك جدول
      const backups = await this.prisma.$queryRaw<any[]>`
        SELECT * FROM "Backup" ORDER BY timestamp DESC LIMIT 50
      `;
      return backups;
    } catch {
      // إذا لم يكن هناك جدول، جلب من S3
      const objects = await this.s3.listObjects(this.bucket, this.BACKUP_PREFIX);
      return objects.map((obj) => ({
        id: obj.Key?.replace(this.BACKUP_PREFIX, '').replace('.json.gz', '') || '',
        timestamp: obj.LastModified || new Date(),
        size: obj.Size || 0,
        type: 'full' as const,
        tables: [],
        status: 'completed' as const,
        s3Key: obj.Key,
      }));
    }
  }

  /**
   * حذف نسخة احتياطية
   */
  async deleteBackup(backupId: string): Promise<void> {
    const s3Key = `${this.BACKUP_PREFIX}${backupId}.json.gz`;
    await this.s3.deleteObject(this.bucket, s3Key);
    this.logger.log(`Deleted backup: ${backupId}`);
  }

  /**
   * نسخ احتياطي مجدول يومي
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledBackup(): Promise<void> {
    try {
      await this.createFullBackup();
      await this.cleanupOldBackups(30); // حذف النسخ الأقدم من 30 يوم
    } catch (error) {
      this.logger.error(`Scheduled backup failed: ${error.message}`);
    }
  }

  /**
   * تنظيف النسخ القديمة
   */
  async cleanupOldBackups(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const backups = await this.listBackups();
    let deleted = 0;

    for (const backup of backups) {
      if (backup.timestamp < cutoffDate) {
        await this.deleteBackup(backup.id);
        deleted++;
      }
    }

    this.logger.log(`Cleaned up ${deleted} old backups`);
    return deleted;
  }

  /**
   * تصدير جدول محدد
   */
  async exportTable(tableName: string): Promise<any[]> {
    try {
      // استخدام $queryRawUnsafe بحذر - اسم الجدول يجب أن يكون موثوقاً
      const validTables = await this.getTableNames();
      if (!validTables.includes(tableName)) {
        throw new Error(`Invalid table name: ${tableName}`);
      }

      return await this.prisma.$queryRawUnsafe(
        `SELECT * FROM "${tableName}"`,
      );
    } catch (error) {
      this.logger.warn(`Failed to export ${tableName}: ${error.message}`);
      return [];
    }
  }

  /**
   * استيراد بيانات لجدول
   */
  private async importTable(tableName: string, data: any[]): Promise<void> {
    if (data.length === 0) return;

    // حذف البيانات الموجودة
    await this.prisma.$executeRawUnsafe(`DELETE FROM "${tableName}"`);

    // إدراج البيانات الجديدة
    for (const row of data) {
      const columns = Object.keys(row);
      const values = columns.map((col) => {
        const val = row[col];
        if (val === null) return 'NULL';
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return val;
      });

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${values.join(', ')})`,
      );
    }
  }

  /**
   * الحصول على أسماء الجداول
   */
  private async getTableNames(): Promise<string[]> {
    const tables = await this.prisma.$queryRaw<any[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    return tables.map((t) => t.tablename).filter(
      (name) => !name.startsWith('_') && name !== 'Backup',
    );
  }

  /**
   * حفظ سجل النسخة الاحتياطية
   */
  private async saveBackupRecord(backup: BackupInfo): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "Backup" (id, timestamp, size, type, tables, status, "s3Key")
        VALUES (${backup.id}, ${backup.timestamp}, ${backup.size}, ${backup.type}, 
                ${backup.tables}, ${backup.status}, ${backup.s3Key})
      `;
    } catch {
      // الجدول قد لا يكون موجوداً
      this.logger.debug('Backup table not found, skipping record save');
    }
  }

  /**
   * تنسيق الحجم
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * الحصول على حالة النسخ الحالي
   */
  getActiveBackup(): BackupInfo | null {
    return this.activeBackup;
  }
}
