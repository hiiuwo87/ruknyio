import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { CacheManager } from '../../../core/cache/cache.manager';
import { EventStatus } from '../dto/create-event.dto';

/**
 * 🔍 Events Queries Service
 * Handles: findAll, findOne, findBySlug, getMyEvents, dashboard views, filters
 *
 * ~280 lines - follows golden rule of ≤300 lines per service
 */
@Injectable()
export class EventsQueriesService {
  constructor(
    private prisma: PrismaService,
    private cacheManager: CacheManager,
  ) {}

  /**
   * Find all events with cursor-based pagination
   */
  async findAll(filters?: {
    status?: EventStatus;
    categoryId?: string;
    eventType?: string;
    isFeatured?: boolean;
    isVirtual?: boolean;
    upcoming?: boolean;
    cursor?: string;
    limit?: number;
  }) {
    const where = this.buildWhereClause(filters);
    const limit = Math.min(filters?.limit || 20, 100);
    const cacheKey = `events:list:${JSON.stringify({ ...filters, limit })}`;

    return this.cacheManager.wrap(cacheKey, 30, async () => {
      const events = await this.prisma.event.findMany({
        where,
        take: limit + 1,
        ...(filters?.cursor && {
          cursor: { id: filters.cursor },
          skip: 1,
        }),
        include: this.getListInclude(),
        orderBy: { startDate: 'asc' },
      });

      return this.buildPaginatedResponse(events, limit);
    });
  }

  /**
   * Find event by ID
   */
  async findOne(id: string, userId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: this.getDetailInclude(userId),
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return this.transformEventResponse(event, userId);
  }

  /**
   * Find event by slug
   */
  async findBySlug(slug: string, userId?: string) {
    this.validateSlugFormat(slug);

    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { name: true, avatar: true } },
          },
        },
        category: true,
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                profile: { select: { name: true, avatar: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { registrations: true, reviews: true, waitlist: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const isRegistered = userId
      ? await this.isUserRegistered(event.id, userId)
      : false;
    const isOwner = userId && event.userId === userId;
    const avgRating = this.calculateAverageRating(event.reviews);

    return {
      ...event,
      avgRating: Math.round(avgRating * 10) / 10,
      meetingUrl: isRegistered || isOwner ? event.meetingUrl : null,
      meetingPassword: isRegistered || isOwner ? event.meetingPassword : null,
    };
  }

  /**
   * Get events owned by user
   */
  async getMyEvents(userId: string) {
    return this.prisma.event.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { name: true, avatar: true } },
          },
        },
        category: true,
        _count: {
          select: { registrations: true, reviews: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(limit = 10) {
    const cacheKey = `events:upcoming:${limit}`;

    return this.cacheManager.wrap(cacheKey, 60, async () => {
      return this.prisma.event.findMany({
        where: {
          startDate: { gte: new Date() },
          status: { in: [EventStatus.SCHEDULED, EventStatus.ONGOING] },
        },
        include: this.getListInclude(),
        orderBy: { startDate: 'asc' },
        take: limit,
      });
    });
  }

  /**
   * Get featured events
   */
  async getFeaturedEvents(limit = 6) {
    const cacheKey = `events:featured:${limit}`;

    return this.cacheManager.wrap(cacheKey, 120, async () => {
      return this.prisma.event.findMany({
        where: {
          isFeatured: true,
          status: { in: [EventStatus.SCHEDULED, EventStatus.ONGOING] },
          startDate: { gte: new Date() },
        },
        include: this.getListInclude(),
        orderBy: { startDate: 'asc' },
        take: limit,
      });
    });
  }

  /**
   * Get event statistics (for WebSocket updates)
   */
  async getEventStats(eventId: string) {
    const [
      totalRegistrations,
      confirmedAttendees,
      waitlistCount,
      checkInsCount,
      reviews,
    ] = await Promise.all([
      this.prisma.eventRegistration.count({
        where: { eventId, status: { in: ['PENDING', 'CONFIRMED'] } },
      }),
      this.prisma.eventRegistration.count({
        where: { eventId, status: 'CONFIRMED' },
      }),
      this.prisma.eventWaitlist.count({
        where: { eventId, status: 'WAITING' },
      }),
      this.prisma.eventTicket.count({
        where: { eventId, status: 'USED' },
      }),
      this.prisma.eventReview.findMany({
        where: { eventId },
        select: { rating: true },
      }),
    ]);

    const avgRating = this.calculateAverageRating(reviews);

    return {
      totalRegistrations,
      confirmedAttendees,
      waitlistCount,
      checkInsCount,
      avgRating: avgRating ? Math.round(avgRating * 10) / 10 : undefined,
      totalReviews: reviews.length,
    };
  }

  // ============ Private Helper Methods ============

  private buildWhereClause(filters?: any): any {
    const where: any = {};

    if (!filters) return where;

    if (filters.status) where.status = filters.status;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.isFeatured !== undefined) where.isFeatured = filters.isFeatured;
    if (filters.isVirtual !== undefined) where.isVirtual = filters.isVirtual;
    if (filters.upcoming) {
      where.startDate = { gte: new Date() };
      where.status = { in: [EventStatus.SCHEDULED, EventStatus.ONGOING] };
    }

    return where;
  }

  private getListInclude() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { name: true, avatar: true } },
        },
      },
      category: true,
      _count: {
        select: { registrations: true, reviews: true },
      },
    };
  }

  private getDetailInclude(userId?: string) {
    return {
      user: {
        select: {
          id: true,
          profile: { select: { name: true, avatar: true } },
        },
      },
      category: true,
      registrations: {
        where: userId ? { userId } : undefined,
        include: {
          user: {
            select: {
              id: true,
              profile: { select: { name: true, avatar: true } },
            },
          },
        },
      },
      reviews: {
        include: {
          user: {
            select: {
              id: true,
              profile: { select: { name: true, avatar: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' as const },
        take: 10,
      },
      _count: {
        select: { registrations: true, reviews: true, waitlist: true },
      },
    };
  }

  private buildPaginatedResponse(events: any[], limit: number) {
    const hasMore = events.length > limit;
    const data = hasMore ? events.slice(0, limit) : events;
    const nextCursor =
      hasMore && data.length > 0 ? data[data.length - 1].id : undefined;

    return {
      data,
      pagination: { limit, hasMore, nextCursor },
    };
  }

  private transformEventResponse(event: any, userId?: string) {
    const avgRating = this.calculateAverageRating(event.reviews);
    const isRegistered =
      userId && event.registrations.some((r: any) => r.userId === userId);
    const isOwner = userId && event.userId === userId;

    return {
      ...event,
      avgRating: Math.round(avgRating * 10) / 10,
      meetingUrl: isRegistered || isOwner ? event.meetingUrl : null,
      meetingPassword: isRegistered || isOwner ? event.meetingPassword : null,
      registrations: event.registrations.map((r: any) => ({
        ...r,
        user: {
          id: r.user.id,
          name: r.user.profile?.name,
          avatar: r.user.profile?.avatar,
        },
      })),
    };
  }

  private validateSlugFormat(slug: string) {
    if (
      !slug ||
      slug.length < 3 ||
      slug.length > 10 ||
      !/^[a-z0-9]+$/.test(slug)
    ) {
      throw new BadRequestException('Invalid slug format');
    }
  }

  private async isUserRegistered(
    eventId: string,
    userId: string,
  ): Promise<boolean> {
    const registration = await this.prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    return !!registration;
  }

  private calculateAverageRating(reviews: any[]): number {
    if (!reviews || reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }
}
