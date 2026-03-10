import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { RedisService } from '../../core/cache/redis.service';
import { CacheManager } from '../../core/cache/cache.manager';
import { EmailService } from '../../integrations/email/email.service';
import { EventsGateway } from './events.gateway';
import { CreateEventDto, EventStatus } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { RegisterEventDto } from './dto/register-event.dto';
import {
  generateShortSlug,
  sanitizeInput,
  isValidUrl,
} from './utils/event.utils';
import { EVENT_CONSTANTS, EVENT_ERRORS } from './constants/event.constants';

@Injectable()
export class EventsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private eventsGateway: EventsGateway,
    private readonly redisService: RedisService,
    private readonly cacheManager: CacheManager,
  ) {}

  async create(userId: string, createEventDto: CreateEventDto) {
    // Generate slug if not provided
    let slug = createEventDto.slug;

    if (!slug) {
      // Generate a unique 6-character slug
      slug = await this.generateUniqueSlug();
    } else {
      // Validate provided slug
      if (
        slug.length < EVENT_CONSTANTS.SLUG.MIN_LENGTH ||
        slug.length > EVENT_CONSTANTS.SLUG.MAX_LENGTH
      ) {
        throw new BadRequestException(
          `Slug must be between ${EVENT_CONSTANTS.SLUG.MIN_LENGTH} and ${EVENT_CONSTANTS.SLUG.MAX_LENGTH} characters`,
        );
      }

      // Check if slug is unique
      const existingEvent = await this.prisma.event.findUnique({
        where: { slug },
      });

      if (existingEvent) {
        throw new BadRequestException(EVENT_ERRORS.SLUG_EXISTS);
      }
    }

    // Sanitize text inputs
    const sanitizedData = {
      ...createEventDto,
      slug,
      title: sanitizeInput(createEventDto.title),
      description: createEventDto.description
        ? sanitizeInput(createEventDto.description)
        : undefined,
      venue: createEventDto.venue
        ? sanitizeInput(createEventDto.venue)
        : undefined,
      location: createEventDto.location
        ? sanitizeInput(createEventDto.location)
        : undefined,
    };

    // Validate dates
    const startDate = new Date(sanitizedData.startDate);
    const endDate = new Date(sanitizedData.endDate);
    const now = new Date();

    if (startDate >= endDate) {
      throw new BadRequestException(EVENT_ERRORS.INVALID_DATES);
    }

    if (startDate < now) {
      throw new BadRequestException(EVENT_ERRORS.PAST_START_DATE);
    }

    // Validate URLs if provided
    if (sanitizedData.meetingUrl && !isValidUrl(sanitizedData.meetingUrl)) {
      throw new BadRequestException(
        EVENT_ERRORS.INVALID_URL + ' (meeting URL)',
      );
    }

    if (sanitizedData.imageUrl && !isValidUrl(sanitizedData.imageUrl)) {
      throw new BadRequestException(EVENT_ERRORS.INVALID_URL + ' (image URL)');
    }

    // Validate price
    if (sanitizedData.price !== undefined && sanitizedData.price < 0) {
      throw new BadRequestException(EVENT_ERRORS.NEGATIVE_PRICE);
    }

    // Validate maxAttendees
    if (
      sanitizedData.maxAttendees !== undefined &&
      sanitizedData.maxAttendees < EVENT_CONSTANTS.LIMITS.MIN_ATTENDEES
    ) {
      throw new BadRequestException(EVENT_ERRORS.INVALID_ATTENDEES);
    }

    // Create event
    const event = await this.prisma.event.create({
      data: {
        ...sanitizedData,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                name: true,
                avatar: true,
              },
            },
          },
        },
        category: true,
      },
    });

    // Send notification to organizer
    await this.emailService.sendEventCreatedNotification(
      event.user.email,
      event.user.profile?.name || 'منظم',
      {
        eventTitle: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        isVirtual: event.isVirtual,
        slug: event.slug,
        maxAttendees: event.maxAttendees,
      },
    );

    // Invalidate dashboard cache for the owner
    try {
      await this.redisService.del(`dashboard:stats:${userId}`);
    } catch (err) {
      console.warn('Redis del error (event create):', err?.message || err);
    }

    return event;
  }

  /**
   * Generate a unique 6-character slug
   */
  private async generateUniqueSlug(): Promise<string> {
    let slug: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      slug = generateShortSlug(EVENT_CONSTANTS.SLUG.DEFAULT_LENGTH);
      const existing = await this.prisma.event.findUnique({
        where: { slug },
      });

      if (!existing) {
        return slug;
      }

      attempts++;
    } while (attempts < maxAttempts);

    throw new BadRequestException(EVENT_ERRORS.SLUG_GENERATION_FAILED);
  }

  /**
   * ⚡ Performance: Cursor-based pagination for better performance on large datasets
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
    const where: any = {};
    const limit = Math.min(filters?.limit || 20, 100); // Max 100 items

    if (filters) {
      if (filters.status) where.status = filters.status;
      if (filters.categoryId) where.categoryId = filters.categoryId;
      if (filters.eventType) where.eventType = filters.eventType;
      if (filters.isFeatured !== undefined)
        where.isFeatured = filters.isFeatured;
      if (filters.isVirtual !== undefined) where.isVirtual = filters.isVirtual;
      if (filters.upcoming) {
        where.startDate = { gte: new Date() };
        where.status = { in: [EventStatus.SCHEDULED, EventStatus.ONGOING] };
      }
    }

    const cacheKey = `events:list:${JSON.stringify({ ...filters, limit })}`;
    const result = await this.cacheManager.wrap(cacheKey, 30, async () => {
      const events = await this.prisma.event.findMany({
        where,
        take: limit + 1, // Fetch one extra to check if more exist
        ...(filters?.cursor && {
          cursor: { id: filters.cursor },
          skip: 1, // Skip the cursor item itself
        }),
        include: {
          user: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  name: true,
                  avatar: true,
                },
              },
            },
          },
          category: true,
          _count: {
            select: {
              registrations: true,
              reviews: true,
            },
          },
        },
        orderBy: {
          startDate: 'asc',
        },
      });

      const hasMore = events.length > limit;
      const data = hasMore ? events.slice(0, limit) : events;
      const nextCursor =
        hasMore && data.length > 0 ? data[data.length - 1].id : undefined;

      return {
        data,
        pagination: {
          limit,
          hasMore,
          nextCursor,
        },
      };
    });

    return result;
  }

  async findOne(id: string, userId?: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
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
        category: true,
        registrations: {
          where: userId ? { userId } : undefined,
          include: {
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
        },
        reviews: {
          include: {
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
          orderBy: {
            createdAt: 'desc',
          },
          take: 10, // Limit to 10 recent reviews
        },
        _count: {
          select: {
            registrations: true,
            reviews: true,
            waitlist: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Calculate average rating
    const avgRating =
      event.reviews.length > 0
        ? event.reviews.reduce((sum, review) => sum + review.rating, 0) /
          event.reviews.length
        : 0;

    // Hide sensitive information for non-registered users
    const isRegistered =
      userId && event.registrations.some((r) => r.userId === userId);
    const isOwner = userId && event.userId === userId;

    const sanitizedEvent = {
      ...event,
      avgRating: Math.round(avgRating * 10) / 10,
      // Hide meeting details unless user is registered or owner
      meetingUrl: isRegistered || isOwner ? event.meetingUrl : null,
      meetingPassword: isRegistered || isOwner ? event.meetingPassword : null,
      // Hide attendee emails for privacy
      registrations: event.registrations.map((r) => ({
        ...r,
        user: {
          id: r.user.id,
          name: r.user.profile?.name,
          avatar: r.user.profile?.avatar,
        },
      })),
    };

    return sanitizedEvent;
  }

  async findBySlug(slug: string, userId?: string) {
    // Validate slug format to prevent injection
    if (
      !slug ||
      slug.length < 3 ||
      slug.length > 10 ||
      !/^[a-z0-9]+$/.test(slug)
    ) {
      throw new BadRequestException('Invalid slug format');
    }

    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
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
        category: true,
        reviews: {
          include: {
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
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
        _count: {
          select: {
            registrations: true,
            reviews: true,
            waitlist: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Calculate average rating
    const avgRating =
      event.reviews.length > 0
        ? event.reviews.reduce((sum, review) => sum + review.rating, 0) /
          event.reviews.length
        : 0;

    // Check if user is registered
    const isRegistered = userId
      ? await this.prisma.eventRegistration.findUnique({
          where: {
            eventId_userId: {
              eventId: event.id,
              userId,
            },
          },
        })
      : null;

    const isOwner = userId && event.userId === userId;

    // Hide sensitive information
    return {
      ...event,
      avgRating: Math.round(avgRating * 10) / 10,
      meetingUrl: isRegistered || isOwner ? event.meetingUrl : null,
      meetingPassword: isRegistered || isOwner ? event.meetingPassword : null,
    };
  }

  async update(id: string, userId: string, updateEventDto: UpdateEventDto) {
    const event = await this.findOne(id, userId);

    // Check ownership
    if (event.userId !== userId) {
      throw new ForbiddenException('You can only update your own events');
    }

    // Sanitize text inputs
    const sanitizedData: any = {};

    if (updateEventDto.title) {
      sanitizedData.title = sanitizeInput(updateEventDto.title);
    }
    if (updateEventDto.description !== undefined) {
      sanitizedData.description = updateEventDto.description
        ? sanitizeInput(updateEventDto.description)
        : null;
    }
    if (updateEventDto.venue !== undefined) {
      sanitizedData.venue = updateEventDto.venue
        ? sanitizeInput(updateEventDto.venue)
        : null;
    }
    if (updateEventDto.location !== undefined) {
      sanitizedData.location = updateEventDto.location
        ? sanitizeInput(updateEventDto.location)
        : null;
    }

    // Validate slug if being updated
    if (updateEventDto.slug && updateEventDto.slug !== event.slug) {
      if (!/^[a-z0-9]+$/.test(updateEventDto.slug)) {
        throw new BadRequestException(
          'Slug must contain only lowercase letters and numbers',
        );
      }

      const existingEvent = await this.prisma.event.findUnique({
        where: { slug: updateEventDto.slug },
      });

      if (existingEvent) {
        throw new BadRequestException('Event slug already exists');
      }

      sanitizedData.slug = updateEventDto.slug;
    }

    // Validate dates if being updated
    if (updateEventDto.startDate || updateEventDto.endDate) {
      const startDate = updateEventDto.startDate || event.startDate;
      const endDate = updateEventDto.endDate || event.endDate;

      if (new Date(startDate) >= new Date(endDate)) {
        throw new BadRequestException('End date must be after start date');
      }

      if (updateEventDto.startDate)
        sanitizedData.startDate = updateEventDto.startDate;
      if (updateEventDto.endDate)
        sanitizedData.endDate = updateEventDto.endDate;
    }

    // Validate URLs
    if (updateEventDto.meetingUrl !== undefined) {
      if (updateEventDto.meetingUrl && !isValidUrl(updateEventDto.meetingUrl)) {
        throw new BadRequestException('Invalid meeting URL format');
      }
      sanitizedData.meetingUrl = updateEventDto.meetingUrl;
    }

    if (updateEventDto.imageUrl !== undefined) {
      if (updateEventDto.imageUrl && !isValidUrl(updateEventDto.imageUrl)) {
        throw new BadRequestException('Invalid image URL format');
      }
      sanitizedData.imageUrl = updateEventDto.imageUrl;
    }

    // Copy other safe fields
    const safeFields = [
      'maxAttendees',
      'price',
      'isFeatured',
      'isVirtual',
      'eventType',
      'categoryId',
      'status',
      'meetingPassword',
    ];
    safeFields.forEach((field) => {
      if (updateEventDto[field] !== undefined) {
        sanitizedData[field] = updateEventDto[field];
      }
    });

    const updatedEvent = await this.prisma.event.update({
      where: { id },
      data: sanitizedData,
      include: {
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
        category: true,
      },
    });

    // 🔥 WebSocket: إشعار تحديث تفاصيل الحدث للمسجلين
    const updatedFields = Object.keys(sanitizedData);
    if (updatedFields.length > 0) {
      this.eventsGateway.emitEventDetailsUpdated(id, {
        updatedFields,
        changes: sanitizedData,
        message: 'Event details have been updated',
        timestamp: new Date(),
      });
    }

    // 🔥 WebSocket: إشعار تغيير الحالة إذا تم التحديث
    if (sanitizedData.status && sanitizedData.status !== event.status) {
      this.eventsGateway.emitEventStatusChanged(id, {
        status: sanitizedData.status,
        message: `Event status changed to ${sanitizedData.status}`,
        timestamp: new Date(),
      });
    }

    // Invalidate dashboard cache for owner
    try {
      await this.redisService.del(`dashboard:stats:${userId}`);
    } catch (err) {
      console.warn('Redis del error (event update):', err?.message || err);
    }

    return updatedEvent;
  }

  async remove(id: string, userId: string) {
    const event = await this.findOne(id);

    // Check ownership
    if (event.userId !== userId) {
      throw new ForbiddenException('You can only delete your own events');
    }

    await this.prisma.event.delete({
      where: { id },
    });

    // Invalidate dashboard cache for owner
    try {
      await this.redisService.del(`dashboard:stats:${userId}`);
    } catch (err) {
      console.warn('Redis del error (event delete):', err?.message || err);
    }

    return { message: 'Event deleted successfully' };
  }

  async register(userId: string, registerEventDto: RegisterEventDto) {
    const { eventId, attendeeCount = 1, notes } = registerEventDto;

    // Check if event exists
    const event = await this.findOne(eventId);

    // Check if event is still open for registration
    if (
      event.status === EventStatus.COMPLETED ||
      event.status === EventStatus.CANCELLED
    ) {
      throw new BadRequestException('Event is not open for registration');
    }

    // Check if user already registered
    const existingRegistration = await this.prisma.eventRegistration.findUnique(
      {
        where: {
          eventId_userId: {
            eventId,
            userId,
          },
        },
      },
    );

    if (existingRegistration) {
      throw new BadRequestException(
        'You are already registered for this event',
      );
    }

    // Check capacity
    if (event.maxAttendees) {
      const currentRegistrations = await this.prisma.eventRegistration.count({
        where: {
          eventId,
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
      });

      if (currentRegistrations + attendeeCount > event.maxAttendees) {
        // Add to waitlist instead
        return this.addToWaitlist(userId, eventId);
      }
    }

    // Create registration
    const registration = await this.prisma.eventRegistration.create({
      data: {
        eventId,
        userId,
        attendeeCount,
        notes,
        status: 'PENDING',
      },
      include: {
        event: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // Send confirmation email
    await this.emailService.sendEventRegistrationConfirmation(
      registration.user.email,
      registration.user.profile?.name || 'Guest',
      {
        eventTitle: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        isVirtual: event.isVirtual,
        meetingUrl: event.meetingUrl,
        organizerName: event.user.profile?.name || 'Organizer',
      },
    );

    // Send notification to organizer
    const totalRegistrations = await this.prisma.eventRegistration.count({
      where: {
        eventId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    await this.emailService.sendNewRegistrationNotification(
      registration.event.user.email,
      registration.event.user.profile?.name || 'Organizer',
      {
        eventTitle: event.title,
        attendeeName: registration.user.profile?.name || 'Guest',
        attendeeEmail: registration.user.email,
        totalRegistrations,
        maxAttendees: event.maxAttendees,
      },
    );

    // 🔥 WebSocket: إشعار فوري للمنظمين
    this.eventsGateway.emitNewRegistration(eventId, {
      attendeeName: registration.user.profile?.name || 'Guest',
      attendeeAvatar: registration.user.profile?.avatar || null,
      totalRegistrations,
      maxAttendees: event.maxAttendees,
      timestamp: new Date(),
    });

    // 🔥 WebSocket: تحديث عدد الأماكن المتاحة لجميع المتصفحين
    const availableSeats = event.maxAttendees
      ? event.maxAttendees - totalRegistrations
      : undefined;

    this.eventsGateway.emitAttendeesCountUpdate(eventId, {
      totalRegistrations,
      maxAttendees: event.maxAttendees,
      availableSeats,
      isFull: event.maxAttendees
        ? totalRegistrations >= event.maxAttendees
        : false,
    });

    // 🔥 WebSocket: تحديث الإحصائيات للمنظمين
    const stats = await this.getEventStats(eventId);
    this.eventsGateway.emitEventStatsUpdate(eventId, stats);

    // Invalidate dashboard cache for organizer
    try {
      const ownerId = event.userId || registration.event?.user?.id;
      if (ownerId) {
        await this.redisService.del(`dashboard:stats:${ownerId}`);
      }
    } catch (err) {
      console.warn('Redis del error (event register):', err?.message || err);
    }

    return registration;
  }

  async cancelRegistration(userId: string, eventId: string) {
    const registration = await this.prisma.eventRegistration.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    if (registration.status === 'CANCELLED') {
      throw new BadRequestException('Registration is already cancelled');
    }

    const updatedRegistration = await this.prisma.eventRegistration.update({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
      include: {
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
        event: {
          select: {
            id: true,
            title: true,
            maxAttendees: true,
            userId: true,
          },
        },
      },
    });

    // 🔥 WebSocket: إشعار الإلغاء للمنظمين
    const totalRegistrations = await this.prisma.eventRegistration.count({
      where: {
        eventId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    this.eventsGateway.emitRegistrationCancelled(eventId, {
      attendeeName: updatedRegistration.user.profile?.name || 'Guest',
      totalRegistrations,
      maxAttendees: updatedRegistration.event.maxAttendees,
      timestamp: new Date(),
    });

    // 🔥 WebSocket: تحديث الأماكن المتاحة
    const availableSeats = updatedRegistration.event.maxAttendees
      ? updatedRegistration.event.maxAttendees - totalRegistrations
      : undefined;

    this.eventsGateway.emitAttendeesCountUpdate(eventId, {
      totalRegistrations,
      maxAttendees: updatedRegistration.event.maxAttendees,
      availableSeats,
      isFull: false,
    });

    // 🔥 WebSocket: إشعار بتوفر أماكن جديدة
    if (availableSeats && availableSeats > 0) {
      this.eventsGateway.emitAvailabilityChanged(eventId, {
        isAvailable: true,
        availableSeats,
        message: `${availableSeats} seats now available!`,
      });
    }

    // Check waitlist and promote next person
    await this.promoteFromWaitlist(eventId);

    return updatedRegistration;
  }

  async getMyRegistrations(userId: string) {
    const registrations = await this.prisma.eventRegistration.findMany({
      where: { userId },
      include: {
        event: {
          include: {
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
            category: true,
          },
        },
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });

    return registrations;
  }

  async getEventRegistrations(eventId: string, userId: string) {
    // First, verify the event exists and user is the owner
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (event.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to view registrations for this event',
      );
    }

    // Get all registrations for the event
    const registrations = await this.prisma.eventRegistration.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });

    return registrations;
  }

  async getMyEvents(userId: string) {
    const events = await this.prisma.event.findMany({
      where: { userId },
      include: {
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
        category: true,
        _count: {
          select: {
            registrations: true,
            reviews: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return events;
  }

  private async addToWaitlist(userId: string, eventId: string) {
    // Check if already on waitlist
    const existingWaitlist = await this.prisma.eventWaitlist.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (existingWaitlist) {
      throw new BadRequestException(
        'You are already on the waitlist for this event',
      );
    }

    // Get next position
    const lastPosition = await this.prisma.eventWaitlist.findFirst({
      where: { eventId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const position = (lastPosition?.position || 0) + 1;

    const waitlistEntry = await this.prisma.eventWaitlist.create({
      data: {
        eventId,
        userId,
        position,
        status: 'WAITING',
      },
      include: {
        event: true,
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Send waitlist notification email
    await this.emailService.sendWaitlistNotification(
      waitlistEntry.user.email,
      waitlistEntry.user.profile?.name || 'Guest',
      {
        eventTitle: waitlistEntry.event.title,
        startDate: waitlistEntry.event.startDate,
      },
    );

    return {
      message: 'Event is full. You have been added to the waitlist.',
      waitlist: waitlistEntry,
    };
  }

  private async promoteFromWaitlist(eventId: string) {
    const nextInLine = await this.prisma.eventWaitlist.findFirst({
      where: {
        eventId,
        status: 'WAITING',
      },
      orderBy: {
        position: 'asc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
          },
        },
      },
    });

    if (nextInLine) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update waitlist status
      await this.prisma.eventWaitlist.update({
        where: { id: nextInLine.id },
        data: {
          status: 'NOTIFIED',
          notifiedAt: new Date(),
          expiresAt,
        },
      });

      // 🔥 WebSocket: إشعار فوري بالترقية من قائمة الانتظار
      this.eventsGateway.emitWaitlistPromotion(nextInLine.user.id, eventId, {
        eventTitle: nextInLine.event.title,
        eventStartDate: nextInLine.event.startDate,
        position: nextInLine.position,
        expiresAt,
      });

      // Send email notification
      await this.emailService.sendWaitlistPromotionNotification(
        nextInLine.user.email,
        nextInLine.user.profile?.name || 'Guest',
        {
          eventTitle: nextInLine.event.title,
          startDate: nextInLine.event.startDate,
          expiresAt,
        },
      );
    }
  }

  /**
   * Helper method to get event statistics for WebSocket updates
   */
  private async getEventStats(eventId: string) {
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
}
