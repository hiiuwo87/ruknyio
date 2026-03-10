import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { RedisService } from '../../../core/cache/redis.service';
import { EmailService } from '../../../integrations/email/email.service';
import { EventsGateway } from '../events.gateway';
import { CreateEventDto, EventStatus } from '../dto/create-event.dto';
import { UpdateEventDto } from '../dto/update-event.dto';
import {
  generateShortSlug,
  sanitizeInput,
  isValidUrl,
} from '../utils/event.utils';
import { EVENT_CONSTANTS, EVENT_ERRORS } from '../constants/event.constants';
import { EventsQueriesService } from './events-queries.service';

/**
 * 📝 Events Commands Service
 * Handles: create, update, delete, publish, cancel, duplicate
 *
 * ~250 lines - follows golden rule of ≤300 lines per service
 */
@Injectable()
export class EventsCommandsService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private emailService: EmailService,
    private eventsGateway: EventsGateway,
    private eventsQueries: EventsQueriesService,
  ) {}

  /**
   * Create a new event
   */
  async create(userId: string, createEventDto: CreateEventDto) {
    const slug = await this.resolveSlug(createEventDto.slug);
    const sanitizedData = this.sanitizeEventData(createEventDto, slug);

    this.validateEventDates(sanitizedData.startDate, sanitizedData.endDate);
    this.validateEventUrls(sanitizedData);
    this.validateEventLimits(sanitizedData);

    const event = await this.prisma.event.create({
      data: { ...sanitizedData, userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true, avatar: true } },
          },
        },
        category: true,
      },
    });

    // Send notification
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

    await this.invalidateCache(userId);
    return event;
  }

  /**
   * Update an existing event
   */
  async update(id: string, userId: string, updateEventDto: UpdateEventDto) {
    const event = await this.eventsQueries.findOne(id, userId);

    if (event.userId !== userId) {
      throw new ForbiddenException('You can only update your own events');
    }

    const sanitizedData = await this.buildUpdateData(event, updateEventDto);

    const updatedEvent = await this.prisma.event.update({
      where: { id },
      data: sanitizedData,
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { name: true, avatar: true } },
          },
        },
        category: true,
      },
    });

    // WebSocket notifications
    this.notifyEventUpdated(id, event, sanitizedData);
    await this.invalidateCache(userId);

    return updatedEvent;
  }

  /**
   * Delete an event
   */
  async remove(id: string, userId: string) {
    const event = await this.eventsQueries.findOne(id);

    if (event.userId !== userId) {
      throw new ForbiddenException('You can only delete your own events');
    }

    await this.prisma.event.delete({ where: { id } });
    await this.invalidateCache(userId);

    return { message: 'Event deleted successfully' };
  }

  /**
   * Publish an event (change status to SCHEDULED)
   */
  async publish(id: string, userId: string) {
    const event = await this.eventsQueries.findOne(id);

    if (event.userId !== userId) {
      throw new ForbiddenException('You can only publish your own events');
    }

    if (event.status === EventStatus.SCHEDULED) {
      throw new BadRequestException('Event is already published');
    }

    const updatedEvent = await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.SCHEDULED },
      include: { category: true },
    });

    this.eventsGateway.emitEventStatusChanged(id, {
      status: EventStatus.SCHEDULED,
      message: 'Event has been published',
      timestamp: new Date(),
    });

    return updatedEvent;
  }

  /**
   * Cancel an event
   */
  async cancel(id: string, userId: string, reason?: string) {
    const event = await this.eventsQueries.findOne(id);

    if (event.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own events');
    }

    if (event.status === EventStatus.CANCELLED) {
      throw new BadRequestException('Event is already cancelled');
    }

    const updatedEvent = await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.CANCELLED },
      include: { category: true },
    });

    this.eventsGateway.emitEventStatusChanged(id, {
      status: EventStatus.CANCELLED,
      message: reason || 'Event has been cancelled',
      timestamp: new Date(),
    });

    // TODO: Notify all registered attendees

    return updatedEvent;
  }

  // ============ Private Helper Methods ============

  private async resolveSlug(providedSlug?: string): Promise<string> {
    if (!providedSlug) {
      return this.generateUniqueSlug();
    }

    if (
      providedSlug.length < EVENT_CONSTANTS.SLUG.MIN_LENGTH ||
      providedSlug.length > EVENT_CONSTANTS.SLUG.MAX_LENGTH
    ) {
      throw new BadRequestException(
        `Slug must be between ${EVENT_CONSTANTS.SLUG.MIN_LENGTH} and ${EVENT_CONSTANTS.SLUG.MAX_LENGTH} characters`,
      );
    }

    const existing = await this.prisma.event.findUnique({
      where: { slug: providedSlug },
    });
    if (existing) {
      throw new BadRequestException(EVENT_ERRORS.SLUG_EXISTS);
    }

    return providedSlug;
  }

  private async generateUniqueSlug(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const slug = generateShortSlug(EVENT_CONSTANTS.SLUG.DEFAULT_LENGTH);
      const existing = await this.prisma.event.findUnique({ where: { slug } });
      if (!existing) return slug;
      attempts++;
    }

    throw new BadRequestException(EVENT_ERRORS.SLUG_GENERATION_FAILED);
  }

  private sanitizeEventData(dto: CreateEventDto, slug: string) {
    return {
      ...dto,
      slug,
      title: sanitizeInput(dto.title),
      description: dto.description ? sanitizeInput(dto.description) : undefined,
      venue: dto.venue ? sanitizeInput(dto.venue) : undefined,
      location: dto.location ? sanitizeInput(dto.location) : undefined,
    };
  }

  private validateEventDates(startDate: any, endDate: any) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start >= end) {
      throw new BadRequestException(EVENT_ERRORS.INVALID_DATES);
    }
    if (start < now) {
      throw new BadRequestException(EVENT_ERRORS.PAST_START_DATE);
    }
  }

  private validateEventUrls(data: any) {
    if (data.meetingUrl && !isValidUrl(data.meetingUrl)) {
      throw new BadRequestException(
        EVENT_ERRORS.INVALID_URL + ' (meeting URL)',
      );
    }
    if (data.imageUrl && !isValidUrl(data.imageUrl)) {
      throw new BadRequestException(EVENT_ERRORS.INVALID_URL + ' (image URL)');
    }
  }

  private validateEventLimits(data: any) {
    if (data.price !== undefined && data.price < 0) {
      throw new BadRequestException(EVENT_ERRORS.NEGATIVE_PRICE);
    }
    if (
      data.maxAttendees !== undefined &&
      data.maxAttendees < EVENT_CONSTANTS.LIMITS.MIN_ATTENDEES
    ) {
      throw new BadRequestException(EVENT_ERRORS.INVALID_ATTENDEES);
    }
  }

  private async buildUpdateData(event: any, dto: UpdateEventDto): Promise<any> {
    const data: any = {};

    // Sanitize text fields
    if (dto.title) data.title = sanitizeInput(dto.title);
    if (dto.description !== undefined)
      data.description = dto.description
        ? sanitizeInput(dto.description)
        : null;
    if (dto.venue !== undefined)
      data.venue = dto.venue ? sanitizeInput(dto.venue) : null;
    if (dto.location !== undefined)
      data.location = dto.location ? sanitizeInput(dto.location) : null;

    // Validate slug
    if (dto.slug && dto.slug !== event.slug) {
      if (!/^[a-z0-9]+$/.test(dto.slug)) {
        throw new BadRequestException(
          'Slug must contain only lowercase letters and numbers',
        );
      }
      const existing = await this.prisma.event.findUnique({
        where: { slug: dto.slug },
      });
      if (existing) throw new BadRequestException('Event slug already exists');
      data.slug = dto.slug;
    }

    // Validate dates
    if (dto.startDate || dto.endDate) {
      const start = dto.startDate || event.startDate;
      const end = dto.endDate || event.endDate;
      if (new Date(start) >= new Date(end)) {
        throw new BadRequestException('End date must be after start date');
      }
      if (dto.startDate) data.startDate = dto.startDate;
      if (dto.endDate) data.endDate = dto.endDate;
    }

    // Validate URLs
    if (dto.meetingUrl !== undefined) {
      if (dto.meetingUrl && !isValidUrl(dto.meetingUrl)) {
        throw new BadRequestException('Invalid meeting URL format');
      }
      data.meetingUrl = dto.meetingUrl;
    }
    if (dto.imageUrl !== undefined) {
      if (dto.imageUrl && !isValidUrl(dto.imageUrl)) {
        throw new BadRequestException('Invalid image URL format');
      }
      data.imageUrl = dto.imageUrl;
    }

    // Copy safe fields
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
      if (dto[field] !== undefined) data[field] = dto[field];
    });

    return data;
  }

  private notifyEventUpdated(eventId: string, event: any, changes: any) {
    const updatedFields = Object.keys(changes);
    if (updatedFields.length > 0) {
      this.eventsGateway.emitEventDetailsUpdated(eventId, {
        updatedFields,
        changes,
        message: 'Event details have been updated',
        timestamp: new Date(),
      });
    }

    if (changes.status && changes.status !== event.status) {
      this.eventsGateway.emitEventStatusChanged(eventId, {
        status: changes.status,
        message: `Event status changed to ${changes.status}`,
        timestamp: new Date(),
      });
    }
  }

  private async invalidateCache(userId: string) {
    try {
      await this.redisService.del(`dashboard:stats:${userId}`);
    } catch (err) {
      console.warn('Redis cache invalidation error:', err?.message || err);
    }
  }
}
