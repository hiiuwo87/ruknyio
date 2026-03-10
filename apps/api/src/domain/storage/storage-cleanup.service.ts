import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StorageService } from './storage.service';

/**
 * تنظيف التخزين: حذف نهائي للملفات التي انتهت مدة الاحتفاظ (30 يوم في سلة المهملات)
 */
@Injectable()
export class StorageCleanupService implements OnModuleInit {
  constructor(private readonly storageService: StorageService) {}

  onModuleInit() {
    console.log('🧹 Storage cleanup service initialized');
  }

  /**
   * تشغيل يومي عند 4 صباحاً: حذف الملفات التي مرّ على حذفها الناعم أكثر من 30 يوم
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeExpiredDeletedFiles() {
    try {
      const { purged } = await this.storageService.purgeExpiredDeletedFiles();
      if (purged > 0) {
        console.log(`🧹 Storage cleanup: purged ${purged} expired deleted file(s)`);
      }
    } catch (error) {
      console.error('Storage cleanup error:', error);
    }
  }

  /**
   * تشغيل يومي عند 5 صباحاً: إعادة احتساب storageUsed من مجموع أحجام UserFile (النشطة فقط).
   * يُصلح أي فرق ناتج عن increment/decrement أو مسارات قديمة.
   */
  @Cron(CronExpression.EVERY_DAY_AT_5AM)
  async recalculateStorageUsed() {
    try {
      const { usersUpdated } = await this.storageService.recalculateStorageUsedForAllUsers();
      if (usersUpdated > 0) {
        console.log(`🧹 Storage cleanup: recalculated storage for ${usersUpdated} user(s)`);
      }
    } catch (error) {
      console.error('Storage recalculate error:', error);
    }
  }
}
