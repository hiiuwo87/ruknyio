import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { StoreStatus, ProductStatus, EventStatus } from '@prisma/client';

export interface SoftDeleteOptions {
  /** تضمين العناصر المحذوفة */
  includeDeleted?: boolean;
  /** فقط العناصر المحذوفة */
  onlyDeleted?: boolean;
}

/**
 * 🗑️ Soft Delete Service
 *
 * نمط الحذف الناعم للحفاظ على البيانات
 * يستخدم حقول status بدلاً من deletedAt
 */
@Injectable()
export class SoftDeleteService {
  private readonly logger = new Logger(SoftDeleteService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * حذف ناعم لمستخدم
   * يتم عن طريق تشفير البريد الإلكتروني
   */
  async softDeleteUser(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted_${Date.now()}_${userId.substring(0, 8)}@deleted.local`,
      },
    });

    this.logger.log(`Soft deleted user: ${userId} (anonymized)`);
  }

  /**
   * استعادة مستخدم محذوف
   */
  async restoreUser(userId: string, originalEmail: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: originalEmail,
      },
    });

    this.logger.log(`Restored user: ${userId}`);
  }

  /**
   * حذف ناعم لمتجر
   */
  async softDeleteStore(storeId: string): Promise<void> {
    await this.prisma.store.update({
      where: { id: storeId },
      data: {
        slug: `deleted_${Date.now()}_${storeId.substring(0, 8)}`,
        status: StoreStatus.INACTIVE,
      },
    });

    this.logger.log(`Soft deleted store: ${storeId}`);
  }

  /**
   * استعادة متجر محذوف
   */
  async restoreStore(storeId: string, originalSlug: string): Promise<void> {
    await this.prisma.store.update({
      where: { id: storeId },
      data: {
        slug: originalSlug,
        status: StoreStatus.ACTIVE,
      },
    });

    this.logger.log(`Restored store: ${storeId}`);
  }

  /**
   * حذف ناعم لحدث
   */
  async softDeleteEvent(eventId: string): Promise<void> {
    await this.prisma.event.update({
      where: { id: eventId },
      data: {
        status: EventStatus.CANCELLED,
      },
    });

    this.logger.log(`Soft deleted event: ${eventId}`);
  }

  /**
   * استعادة حدث محذوف
   */
  async restoreEvent(eventId: string): Promise<void> {
    await this.prisma.event.update({
      where: { id: eventId },
      data: {
        status: EventStatus.SCHEDULED,
      },
    });

    this.logger.log(`Restored event: ${eventId}`);
  }

  /**
   * حذف ناعم لمنتج
   */
  async softDeleteProduct(productId: string): Promise<void> {
    await this.prisma.products.update({
      where: { id: productId },
      data: {
        status: ProductStatus.INACTIVE,
      },
    });

    this.logger.log(`Soft deleted product: ${productId}`);
  }

  /**
   * استعادة منتج محذوف
   */
  async restoreProduct(productId: string): Promise<void> {
    await this.prisma.products.update({
      where: { id: productId },
      data: {
        status: ProductStatus.ACTIVE,
      },
    });

    this.logger.log(`Restored product: ${productId}`);
  }

  /**
   * الحصول على العناصر المحذوفة (غير نشطة)
   */
  async getDeletedItems(type: 'user' | 'store' | 'event' | 'product', options?: {
    page?: number;
    limit?: number;
  }): Promise<{ items: any[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    switch (type) {
      case 'user':
        const [users, userCount] = await Promise.all([
          this.prisma.user.findMany({
            where: { 
              email: { startsWith: 'deleted_' }
            },
            skip,
            take: limit,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              email: true,
              updatedAt: true,
              createdAt: true,
            },
          }),
          this.prisma.user.count({
            where: { email: { startsWith: 'deleted_' } },
          }),
        ]);
        return { items: users, total: userCount };

      case 'store':
        const [stores, storeCount] = await Promise.all([
          this.prisma.store.findMany({
            where: { status: StoreStatus.INACTIVE },
            skip,
            take: limit,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              name: true,
              status: true,
              updatedAt: true,
              createdAt: true,
            },
          }),
          this.prisma.store.count({
            where: { status: StoreStatus.INACTIVE },
          }),
        ]);
        return { items: stores, total: storeCount };

      case 'event':
        const [events, eventCount] = await Promise.all([
          this.prisma.event.findMany({
            where: { status: EventStatus.CANCELLED },
            skip,
            take: limit,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              title: true,
              status: true,
              updatedAt: true,
              createdAt: true,
            },
          }),
          this.prisma.event.count({
            where: { status: EventStatus.CANCELLED },
          }),
        ]);
        return { items: events, total: eventCount };

      case 'product':
        const [products, productCount] = await Promise.all([
          this.prisma.products.findMany({
            where: { status: ProductStatus.INACTIVE },
            skip,
            take: limit,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              name: true,
              status: true,
              updatedAt: true,
              createdAt: true,
            },
          }),
          this.prisma.products.count({
            where: { status: ProductStatus.INACTIVE },
          }),
        ]);
        return { items: products, total: productCount };

      default:
        return { items: [], total: 0 };
    }
  }

  /**
   * حذف نهائي للعناصر القديمة
   */
  async permanentDeleteOldItems(daysOld: number = 90): Promise<{
    users: number;
    stores: number;
    events: number;
    products: number;
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Delete anonymized users older than cutoff
    const users = await this.prisma.user.deleteMany({
      where: {
        email: { startsWith: 'deleted_' },
        updatedAt: { lt: cutoffDate },
      },
    });

    // Delete inactive stores older than cutoff
    const stores = await this.prisma.store.deleteMany({
      where: {
        status: StoreStatus.INACTIVE,
        slug: { startsWith: 'deleted_' },
        updatedAt: { lt: cutoffDate },
      },
    });

    // Delete cancelled events older than cutoff
    const events = await this.prisma.event.deleteMany({
      where: {
        status: EventStatus.CANCELLED,
        updatedAt: { lt: cutoffDate },
      },
    });

    // Delete archived products older than cutoff
    const products = await this.prisma.products.deleteMany({
      where: {
        status: ProductStatus.INACTIVE,
        updatedAt: { lt: cutoffDate },
      },
    });

    const result = {
      users: users.count,
      stores: stores.count,
      events: events.count,
      products: products.count,
    };

    this.logger.log(`Permanently deleted old items: ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * إحصائيات الحذف الناعم
   */
  async getSoftDeleteStats(): Promise<{
    users: number;
    stores: number;
    events: number;
    products: number;
    totalRecoverable: number;
  }> {
    const [users, stores, events, products] = await Promise.all([
      this.prisma.user.count({ where: { email: { startsWith: 'deleted_' } } }),
      this.prisma.store.count({ where: { status: StoreStatus.INACTIVE } }),
      this.prisma.event.count({ where: { status: EventStatus.CANCELLED } }),
      this.prisma.products.count({ where: { status: ProductStatus.INACTIVE } }),
    ]);

    return {
      users,
      stores,
      events,
      products,
      totalRecoverable: users + stores + events + products,
    };
  }
}
