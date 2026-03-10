import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { CacheManager } from '../../core/cache/cache.manager';
import { CacheKeys, CACHE_TTL, CACHE_TAGS } from '../../core/cache/cache.constants';
import { EventStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheManager: CacheManager,
  ) {}

  async getQuickStats(userId: string) {
    const cacheKey = CacheKeys.dashboardStats(userId);

    // ⚡ Use CacheManager.wrap for automatic cache handling with tags
    return this.cacheManager.wrap(
      cacheKey,
      CACHE_TTL.DASHBOARD,
      async () => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // ⚡ Performance: Run ALL queries in parallel using Promise.all
        // This reduces ~8 sequential queries to 1 parallel batch
        const [
          // Events stats (2 queries)
          activeEvents,
          totalEvents,
          // Forms stats (2 queries)
          activeForms,
          totalForms,
          // Form submissions count
          totalFormSubmissions,
          // User's store
          userStore,
        ] = await Promise.all([
          // Events
          this.prisma.event.count({
            where: {
              userId,
              status: EventStatus.SCHEDULED,
              endDate: { gte: now },
            },
          }),
          this.prisma.event.count({
            where: { userId },
          }),
          // Forms
          this.prisma.form.count({
            where: {
              userId,
              status: 'PUBLISHED',
            },
          }),
          this.prisma.form.count({
            where: { userId },
          }),
          // Total form submissions count
          this.prisma.form_submissions.count({
            where: {
              form: { userId },
            },
          }),
          // Store (for products + orders)
          this.prisma.store.findFirst({
            where: { userId },
            select: { id: true },
          }),
        ]);

        // ⚡ Performance: Second batch for store-dependent + registration queries
        let activeProducts = 0;
        let totalProducts = 0;
        let totalViews = 0;
        let monthViews = 0;

        const secondBatchPromises: Promise<number>[] = [
          // Event registrations as engagement metric
          this.prisma.eventRegistration
            .count({
              where: { event: { userId } },
            })
            .catch(() => 0),
          this.prisma.eventRegistration
            .count({
              where: {
                event: { userId },
                createdAt: { gte: startOfMonth },
              },
            })
            .catch(() => 0),
        ];

        // Only add product queries if user has a store
        if (userStore) {
          secondBatchPromises.push(
            this.prisma.products
              .count({
                where: { storeId: userStore.id, status: 'ACTIVE' },
              })
              .catch(() => 0),
            this.prisma.products
              .count({
                where: { storeId: userStore.id },
              })
              .catch(() => 0),
          );
        }

        const secondBatchResults = await Promise.all(secondBatchPromises);

        totalViews = secondBatchResults[0];
        monthViews = secondBatchResults[1];

        if (userStore) {
          activeProducts = secondBatchResults[2] || 0;
          totalProducts = secondBatchResults[3] || 0;
        }

        return {
          events: {
            active: activeEvents,
            total: totalEvents,
          },
          products: {
            active: activeProducts,
            total: totalProducts,
          },
          forms: {
            active: activeForms,
            total: totalForms,
            submissions: totalFormSubmissions,
          },
          views: {
            total: totalViews,
            thisMonth: monthViews,
          },
        };
      },
      { tags: [CACHE_TAGS.USER] },
    );
  }

  async getRecentActivity(userId: string, limit: number = 10) {
    const cacheKey = CacheKeys.dashboardActivity(userId);

    // ⚡ Cache for 1 minute - activity changes frequently
    return this.cacheManager.wrap(
      cacheKey,
      CACHE_TTL.SHORT,
      async () => this.fetchRecentActivity(userId, limit),
      { tags: [CACHE_TAGS.USER] },
    );
  }

  /**
   * 📊 Get chart data for revenue/orders over time
   */
  async getChartData(userId: string, days: number = 7) {
    const cacheKey = `dashboard:chart:${userId}:${days}`;

    return this.cacheManager.wrap(
      cacheKey,
      CACHE_TTL.SHORT,
      async () => this.fetchChartData(userId, days),
      { tags: [CACHE_TAGS.USER] },
    );
  }

  /**
   * ⚡ Internal method to fetch chart data
   */
  private async fetchChartData(userId: string, days: number) {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - days);

    // Get user's store
    const userStore = await this.prisma.store.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!userStore) {
      return this.generateEmptyChartData(days);
    }

    // Get orders for current and previous period
    const [currentOrders, previousOrders] = await Promise.all([
      this.prisma.orders.findMany({
        where: {
          storeId: userStore.id,
          createdAt: { gte: startDate },
        },
        select: {
          id: true,
          total: true,
          createdAt: true,
          status: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.orders.findMany({
        where: {
          storeId: userStore.id,
          createdAt: {
            gte: previousStartDate,
            lt: startDate,
          },
        },
        select: {
          id: true,
          total: true,
          createdAt: true,
          status: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    // Generate daily data
    const currentData = this.aggregateByDay(currentOrders, startDate, days);
    const previousData = this.aggregateByDay(previousOrders, previousStartDate, days);

    return {
      current: currentData,
      previous: previousData,
      summary: {
        currentTotal: currentData.reduce((sum, d) => sum + d.revenue, 0),
        previousTotal: previousData.reduce((sum, d) => sum + d.revenue, 0),
        currentOrders: currentData.reduce((sum, d) => sum + d.orders, 0),
        previousOrders: previousData.reduce((sum, d) => sum + d.orders, 0),
      },
    };
  }

  /**
   * Aggregate orders by day
   */
  private aggregateByDay(orders: any[], startDate: Date, days: number) {
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const data = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayOrders = orders.filter((o) => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= dayStart && orderDate <= dayEnd;
      });

      data.push({
        day: dayNames[dayStart.getDay()],
        date: dayStart.toISOString().split('T')[0],
        orders: dayOrders.length,
        revenue: dayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
        products: dayOrders.length, // Simplified
      });
    }

    return data;
  }

  /**
   * Generate empty chart data
   */
  private generateEmptyChartData(days: number) {
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const now = new Date();
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      data.push({
        day: dayNames[date.getDay()],
        date: date.toISOString().split('T')[0],
        orders: 0,
        revenue: 0,
        products: 0,
      });
    }

    return {
      current: data,
      previous: data,
      summary: {
        currentTotal: 0,
        previousTotal: 0,
        currentOrders: 0,
        previousOrders: 0,
      },
    };
  }

  /**
   * 📊 Get traffic sources data
   */
  async getTrafficSources(userId: string) {
    const cacheKey = `dashboard:traffic:${userId}`;

    return this.cacheManager.wrap(
      cacheKey,
      CACHE_TTL.MEDIUM,
      async () => this.fetchTrafficSources(userId),
      { tags: [CACHE_TAGS.USER] },
    );
  }

  /**
   * ⚡ Internal method to fetch traffic sources
   * يجلب إحصائيات حقيقية من مصادر متعددة
   */
  private async fetchTrafficSources(userId: string) {
    try {
      // 1. جلب الـ profile للمستخدم
      const userProfile = await this.prisma.profile.findFirst({
        where: { userId },
        select: { id: true },
      });

      // تجميع النقرات حسب المنصة
      const platformClicks: Record<string, number> = {};

      if (userProfile) {
        // جلب إحصائيات الروابط الاجتماعية
        const socialLinks = await this.prisma.socialLink.findMany({
          where: { profileId: userProfile.id },
          select: { platform: true, totalClicks: true },
        });

        socialLinks.forEach((link) => {
          const platform = link.platform || 'رابط';
          platformClicks[platform] = (platformClicks[platform] || 0) + (link.totalClicks || 0);
        });
      }

      // 2. جلب إحصائيات المتجر
      const userStore = await this.prisma.store.findFirst({
        where: { userId },
        select: { id: true },
      });

      let productCount = 0;
      let orderSources: { source: string; count: number }[] = [];

      if (userStore) {
        // عدد المنتجات النشطة
        productCount = await this.prisma.products.count({
          where: { storeId: userStore.id, status: 'ACTIVE' },
        });

        // الطلبات الأخيرة (نستخدمها كمؤشر للمصادر)
        const recentOrders = await this.prisma.orders.count({
          where: { storeId: userStore.id },
        });
        orderSources.push({ source: 'الطلبات', count: recentOrders });
      }

      // 3. جلب تسجيلات الفعاليات
      const eventRegistrations = await this.prisma.eventRegistration.count({
        where: { event: { userId } },
      });

      // 4. جلب ردود النماذج
      const formSubmissions = await this.prisma.form_submissions.count({
        where: { form: { userId } },
      });

      // بناء البيانات من مصادر حقيقية
      const sources: { name: string; value: number }[] = [];

      // إضافة إحصائيات الروابط
      Object.entries(platformClicks).forEach(([platform, clicks]) => {
        if (clicks > 0) {
          sources.push({
            name: platform,
            value: clicks,
          });
        }
      });

      // إضافة مصادر أخرى
      if (productCount > 0) {
        sources.push({ name: 'المنتجات', value: productCount });
      }
      if (eventRegistrations > 0) {
        sources.push({ name: 'الفعاليات', value: eventRegistrations });
      }
      if (formSubmissions > 0) {
        sources.push({ name: 'النماذج', value: formSubmissions });
      }
      if (orderSources.length > 0 && orderSources[0].count > 0) {
        sources.push({ name: 'الطلبات', value: orderSources[0].count });
      }

      // ترتيب حسب القيمة
      sources.sort((a, b) => b.value - a.value);

      // إذا توفرت بيانات حقيقية
      if (sources.length > 0) {
        const maxValue = Math.max(...sources.map((s) => s.value));
        return sources.slice(0, 7).map((s, index) => ({
          name: s.name,
          value: s.value,
          percentage: maxValue > 0 ? Math.round((s.value / maxValue) * 100) : 0,
          color: index === 0 ? 'bg-foreground' : 
                 index < 3 ? 'bg-slate-500 dark:bg-slate-400' : 
                 'bg-slate-300 dark:bg-slate-600',
        }));
      }
    } catch (error) {
      this.logger.warn('Could not fetch traffic sources:', error.message);
    }

    // بيانات افتراضية إذا لم تتوفر بيانات
    return [
      { name: 'لا توجد بيانات', value: 0, percentage: 0, color: 'bg-muted' },
    ];
  }

  /**
   * ⚡ Internal method to fetch recent activity (used by cache wrapper)
   */
  private async fetchRecentActivity(userId: string, limit: number) {
    const activities: any[] = [];

    // ===== 1. نشاطات الحساب الشخصية (النماذج، الفعاليات، المنتجات) =====

    // Get user's recently created/updated forms
    try {
      const recentForms = await this.prisma.form.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      });

      recentForms.forEach((form) => {
        const isNew =
          new Date(form.updatedAt).getTime() -
            new Date(form.createdAt).getTime() <
          60000; // Less than 1 minute difference = new
        activities.push({
          id: `form-${form.id}`,
          type: isNew ? 'form_created' : 'form_updated',
          title: isNew ? 'تم إنشاء نموذج جديد' : 'تم تعديل نموذج',
          description: form.title,
          href: `/app/forms/${form.slug}`,
          createdAt: isNew ? form.createdAt : form.updatedAt,
        });
      });
    } catch (error) {
      console.log('Could not get user forms:', error.message);
    }

    // Get user's recently created/updated events
    try {
      const recentEvents = await this.prisma.event.findMany({
        where: { userId },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      });

      recentEvents.forEach((event) => {
        const isNew =
          new Date(event.updatedAt).getTime() -
            new Date(event.createdAt).getTime() <
          60000;
        activities.push({
          id: `event-${event.id}`,
          type: isNew ? 'event_created' : 'event_updated',
          title: isNew ? 'تم إنشاء فعالية جديدة' : 'تم تعديل فعالية',
          description: event.title,
          href: `/app/events/${event.slug}`,
          createdAt: isNew ? event.createdAt : event.updatedAt,
        });
      });
    } catch (error) {
      console.log('Could not get user events:', error.message);
    }

    // Get user's store and recent products
    try {
      const userStore = await this.prisma.store.findFirst({
        where: { userId },
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      });

      if (userStore) {
        // Store creation/update
        const storeIsNew =
          new Date(userStore.updatedAt).getTime() -
            new Date(userStore.createdAt).getTime() <
          60000;
        if (storeIsNew) {
          activities.push({
            id: `store-${userStore.id}`,
            type: 'store_created',
            title: 'تم إنشاء متجر جديد',
            description: userStore.name,
            href: '/app/store',
            createdAt: userStore.createdAt,
          });
        }

        // Recent products
        const recentProducts = await this.prisma.products.findMany({
          where: { storeId: userStore.id },
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        });

        recentProducts.forEach((product) => {
          const isNew =
            new Date(product.updatedAt).getTime() -
              new Date(product.createdAt).getTime() <
            60000;
          activities.push({
            id: `product-${product.id}`,
            type: isNew ? 'product_created' : 'product_updated',
            title: isNew ? 'تم إضافة منتج جديد' : 'تم تعديل منتج',
            description: product.name,
            href: `/app/store/products/${product.slug}`,
            createdAt: isNew ? product.createdAt : product.updatedAt,
          });
        });

        // Recent orders received
        const recentOrders = await this.prisma.orders.findMany({
          where: { storeId: userStore.id },
          include: {
            users: {
              select: {
                id: true,
                profile: {
                  select: {
                    name: true,
                    avatar: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        recentOrders.forEach((order) => {
          activities.push({
            id: `order-${order.id}`,
            type: 'order_received',
            title: `طلب جديد #${order.orderNumber || order.id.slice(0, 8)}`,
            description: `${order.total} ${order.currency || 'IQD'} - ${order.users?.profile?.name || 'عميل'}`,
            avatar: order.users?.profile?.avatar,
            href: `/app/store/orders/${order.id}`,
            createdAt: order.createdAt,
          });
        });
      }
    } catch (error) {
      console.log('Could not get store data:', error.message);
    }

    // ===== 2. نشاطات الآخرين المتعلقة بحساب المستخدم =====

    // Get recent event registrations (people registered to user's events)
    try {
      const recentRegistrations = await this.prisma.eventRegistration.findMany({
        where: {
          event: { userId },
        },
        include: {
          event: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
          user: {
            select: {
              id: true,
              profile: {
                select: {
                  name: true,
                  avatar: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      recentRegistrations.forEach((reg) => {
        activities.push({
          id: `reg-${reg.id}`,
          type: 'event_registration',
          title: `تسجيل جديد في فعاليتك`,
          description: `${reg.user?.profile?.name || 'مستخدم'} سجل في "${reg.event.title}"`,
          avatar: reg.user?.profile?.avatar,
          href: `/app/events/${reg.event.slug}`,
          createdAt: reg.createdAt,
        });
      });
    } catch (error) {
      console.log('Could not get event registrations:', error.message);
    }

    // Get recent form submissions
    try {
      const recentSubmissions = await this.prisma.form_submissions.findMany({
        where: {
          form: { userId },
        },
        include: {
          form: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      recentSubmissions.forEach((sub) => {
        activities.push({
          id: `sub-${sub.id}`,
          type: 'form_submission',
          title: 'رد جديد على نموذجك',
          description: `تم استلام رد على "${sub.form.title}"`,
          href: `/app/forms/${sub.form.slug}/responses`,
          createdAt: sub.createdAt,
        });
      });
    } catch (error) {
      console.log('Could not get form submissions:', error.message);
    }

    // ===== 3. تغييرات الملف الشخصي =====
    try {
      const profile = await this.prisma.profile.findUnique({
        where: { userId },
        select: {
          updatedAt: true,
          createdAt: true,
          name: true,
        },
      });

      if (profile) {
        const profileIsNew =
          new Date(profile.updatedAt).getTime() -
            new Date(profile.createdAt).getTime() <
          60000;
        // Only show if updated in last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        if (new Date(profile.updatedAt) > sevenDaysAgo) {
          activities.push({
            id: `profile-${userId}`,
            type: profileIsNew ? 'profile_created' : 'profile_updated',
            title: profileIsNew
              ? 'تم إنشاء الملف الشخصي'
              : 'تم تحديث الملف الشخصي',
            description: profile.name || 'الملف الشخصي',
            href: '/app/settings/profile',
            createdAt: profile.updatedAt,
          });
        }
      }
    } catch (error) {
      console.log('Could not get profile data:', error.message);
    }

    // Sort all activities by date and return top items
    activities.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Remove duplicates based on id
    const uniqueActivities = activities.filter(
      (activity, index, self) =>
        index === self.findIndex((a) => a.id === activity.id),
    );

    return uniqueActivities.slice(0, limit);
  }
}
