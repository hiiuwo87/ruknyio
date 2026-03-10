import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { RegistrationStatus } from '@prisma/client';
import {
  IEventsRepository,
  EventWithRelations,
  EventFilters,
  PaginationOptions,
  PaginatedResult,
} from './events.repository.interface';
import {
  CreateEventDto,
  EventStatus,
} from '../../../domain/events/dto/create-event.dto';
import { UpdateEventDto } from '../../../domain/events/dto/update-event.dto';

/**
 * 🔌 Prisma Events Repository Implementation
 *
 * Implements IEventsRepository using Prisma ORM.
 * This keeps all Prisma-specific code isolated from the domain layer.
 */
@Injectable()
export class PrismaEventsRepository implements IEventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ============ CRUD Operations ============

  async create(
    userId: string,
    data: CreateEventDto & { slug: string },
  ): Promise<EventWithRelations> {
    return this.prisma.event.create({
      data: { ...data, userId },
      include: this.getDefaultInclude(),
    });
  }

  async findById(id: string): Promise<EventWithRelations | null> {
    return this.prisma.event.findUnique({
      where: { id },
      include: this.getDetailInclude(),
    });
  }

  async findBySlug(slug: string): Promise<EventWithRelations | null> {
    return this.prisma.event.findUnique({
      where: { slug },
      include: this.getDetailInclude(),
    });
  }

  async update(
    id: string,
    data: Partial<UpdateEventDto>,
  ): Promise<EventWithRelations> {
    return this.prisma.event.update({
      where: { id },
      data,
      include: this.getDefaultInclude(),
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.event.delete({ where: { id } });
  }

  // ============ Query Operations ============

  async findAll(
    filters?: EventFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<EventWithRelations>> {
    const where = this.buildWhereClause(filters);
    const limit = Math.min(pagination?.limit || 20, 100);

    const events = await this.prisma.event.findMany({
      where,
      take: limit + 1,
      ...(pagination?.cursor && {
        cursor: { id: pagination.cursor },
        skip: 1,
      }),
      include: this.getListInclude(),
      orderBy: pagination?.orderBy || { startDate: 'asc' },
    });

    const hasMore = events.length > limit;
    const data = hasMore ? events.slice(0, limit) : events;
    const nextCursor =
      hasMore && data.length > 0 ? data[data.length - 1].id : undefined;

    return {
      data,
      pagination: { limit, hasMore, nextCursor },
    };
  }

  async findByUserId(userId: string): Promise<EventWithRelations[]> {
    return this.prisma.event.findMany({
      where: { userId },
      include: this.getListInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async slugExists(slug: string): Promise<boolean> {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      select: { id: true },
    });
    return !!event;
  }

  // ============ Registration Operations ============

  async getRegistrationCount(
    eventId: string,
    statuses?: RegistrationStatus[],
  ): Promise<number> {
    return this.prisma.eventRegistration.count({
      where: {
        eventId,
        ...(statuses && { status: { in: statuses } }),
      },
    });
  }

  async isUserRegistered(eventId: string, userId: string): Promise<boolean> {
    const registration = await this.prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { id: true },
    });
    return !!registration;
  }

  // ============ Statistics ============

  async getStats(eventId: string) {
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

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : undefined;

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

  private buildWhereClause(filters?: EventFilters): any {
    const where: any = {};

    if (!filters) return where;

    if (filters.status) where.status = filters.status;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.isFeatured !== undefined) where.isFeatured = filters.isFeatured;
    if (filters.isVirtual !== undefined) where.isVirtual = filters.isVirtual;
    if (filters.userId) where.userId = filters.userId;
    if (filters.upcoming) {
      where.startDate = { gte: new Date() };
      where.status = { in: [EventStatus.SCHEDULED, EventStatus.ONGOING] };
    }

    return where;
  }

  private getDefaultInclude() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          profile: { select: { name: true, avatar: true } },
        },
      },
      category: true,
    };
  }

  private getListInclude() {
    return {
      ...this.getDefaultInclude(),
      _count: {
        select: { registrations: true, reviews: true },
      },
    };
  }

  private getDetailInclude() {
    return {
      ...this.getDefaultInclude(),
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
}
