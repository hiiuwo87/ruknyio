import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma/prisma.service';
import { RedisService } from '../../../core/cache/redis.service';
import { EmailService } from '../../../integrations/email/email.service';
import { EventsGateway } from '../events.gateway';
import { RegisterEventDto } from '../dto/register-event.dto';
import { EventStatus } from '../dto/create-event.dto';
import { EventsQueriesService } from './events-queries.service';

/**
 * 📋 Events Registration Service
 * Handles: register, unregister, waitlist, limits, attendee management
 *
 * ~300 lines - follows golden rule of ≤300 lines per service
 */
@Injectable()
export class EventsRegistrationService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private emailService: EmailService,
    private eventsGateway: EventsGateway,
    private eventsQueries: EventsQueriesService,
  ) {}

  /**
   * Register for an event
   */
  async register(userId: string, dto: RegisterEventDto) {
    const { eventId, attendeeCount = 1, notes } = dto;
    const event = await this.eventsQueries.findOne(eventId);

    this.validateEventForRegistration(event);
    await this.checkExistingRegistration(eventId, userId);

    // Check capacity and add to waitlist if full
    if (event.maxAttendees) {
      const currentCount = await this.getActiveRegistrationCount(eventId);
      if (currentCount + attendeeCount > event.maxAttendees) {
        return this.addToWaitlist(userId, eventId);
      }
    }

    const registration = await this.createRegistration(
      eventId,
      userId,
      attendeeCount,
      notes,
    );

    // Send notifications
    await this.sendRegistrationNotifications(registration, event);

    // WebSocket updates
    await this.broadcastRegistrationUpdate(eventId, event, registration);

    await this.invalidateOwnerCache(event.userId);

    return registration;
  }

  /**
   * Cancel registration
   */
  async cancelRegistration(userId: string, eventId: string) {
    const registration = await this.prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    if (registration.status === 'CANCELLED') {
      throw new BadRequestException('Registration is already cancelled');
    }

    const updated = await this.prisma.eventRegistration.update({
      where: { eventId_userId: { eventId, userId } },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { name: true, avatar: true } },
          },
        },
        event: {
          select: { id: true, title: true, maxAttendees: true, userId: true },
        },
      },
    });

    // WebSocket notifications
    await this.broadcastCancellationUpdate(eventId, updated);

    // Promote next from waitlist
    await this.promoteFromWaitlist(eventId);

    return updated;
  }

  /**
   * Get user's registrations
   */
  async getMyRegistrations(userId: string) {
    return this.prisma.eventRegistration.findMany({
      where: { userId },
      include: {
        event: {
          include: {
            user: {
              select: {
                id: true,
                profile: { select: { name: true, avatar: true } },
              },
            },
            category: true,
          },
        },
      },
      orderBy: { registeredAt: 'desc' },
    });
  }

  /**
   * Get event registrations (owner only)
   */
  async getEventRegistrations(eventId: string, userId: string) {
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

    return this.prisma.eventRegistration.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true, avatar: true } },
          },
        },
      },
      orderBy: { registeredAt: 'desc' },
    });
  }

  /**
   * Confirm registration (owner only)
   */
  async confirmRegistration(
    eventId: string,
    userId: string,
    registrationId: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event || event.userId !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    return this.prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });
  }

  // ============ Waitlist Methods ============

  /**
   * Add user to waitlist
   */
  private async addToWaitlist(userId: string, eventId: string) {
    const existing = await this.prisma.eventWaitlist.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (existing) {
      throw new BadRequestException(
        'You are already on the waitlist for this event',
      );
    }

    const lastPosition = await this.prisma.eventWaitlist.findFirst({
      where: { eventId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const position = (lastPosition?.position || 0) + 1;

    const waitlistEntry = await this.prisma.eventWaitlist.create({
      data: { eventId, userId, position, status: 'WAITING' },
      include: {
        event: true,
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true } },
          },
        },
      },
    });

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

  /**
   * Promote next person from waitlist
   */
  private async promoteFromWaitlist(eventId: string) {
    const nextInLine = await this.prisma.eventWaitlist.findFirst({
      where: { eventId, status: 'WAITING' },
      orderBy: { position: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true } },
          },
        },
        event: {
          select: { id: true, title: true, startDate: true },
        },
      },
    });

    if (!nextInLine) return;

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.eventWaitlist.update({
      where: { id: nextInLine.id },
      data: { status: 'NOTIFIED', notifiedAt: new Date(), expiresAt },
    });

    this.eventsGateway.emitWaitlistPromotion(nextInLine.user.id, eventId, {
      eventTitle: nextInLine.event.title,
      eventStartDate: nextInLine.event.startDate,
      position: nextInLine.position,
      expiresAt,
    });

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

  // ============ Private Helper Methods ============

  private validateEventForRegistration(event: any) {
    if (
      event.status === EventStatus.COMPLETED ||
      event.status === EventStatus.CANCELLED
    ) {
      throw new BadRequestException('Event is not open for registration');
    }
  }

  private async checkExistingRegistration(eventId: string, userId: string) {
    const existing = await this.prisma.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (existing) {
      throw new BadRequestException(
        'You are already registered for this event',
      );
    }
  }

  private async getActiveRegistrationCount(eventId: string): Promise<number> {
    return this.prisma.eventRegistration.count({
      where: { eventId, status: { in: ['PENDING', 'CONFIRMED'] } },
    });
  }

  private async createRegistration(
    eventId: string,
    userId: string,
    attendeeCount: number,
    notes?: string,
  ) {
    return this.prisma.eventRegistration.create({
      data: { eventId, userId, attendeeCount, notes, status: 'PENDING' },
      include: {
        event: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: { select: { name: true } },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true, avatar: true } },
          },
        },
      },
    });
  }

  private async sendRegistrationNotifications(registration: any, event: any) {
    // Confirmation to attendee
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

    const totalRegistrations = await this.getActiveRegistrationCount(event.id);

    // Notification to organizer
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
  }

  private async broadcastRegistrationUpdate(
    eventId: string,
    event: any,
    registration: any,
  ) {
    const totalRegistrations = await this.getActiveRegistrationCount(eventId);
    const availableSeats = event.maxAttendees
      ? event.maxAttendees - totalRegistrations
      : undefined;

    this.eventsGateway.emitNewRegistration(eventId, {
      attendeeName: registration.user.profile?.name || 'Guest',
      attendeeAvatar: registration.user.profile?.avatar || null,
      totalRegistrations,
      maxAttendees: event.maxAttendees,
      timestamp: new Date(),
    });

    this.eventsGateway.emitAttendeesCountUpdate(eventId, {
      totalRegistrations,
      maxAttendees: event.maxAttendees,
      availableSeats,
      isFull: event.maxAttendees
        ? totalRegistrations >= event.maxAttendees
        : false,
    });

    const stats = await this.eventsQueries.getEventStats(eventId);
    this.eventsGateway.emitEventStatsUpdate(eventId, stats);
  }

  private async broadcastCancellationUpdate(
    eventId: string,
    registration: any,
  ) {
    const totalRegistrations = await this.getActiveRegistrationCount(eventId);
    const availableSeats = registration.event.maxAttendees
      ? registration.event.maxAttendees - totalRegistrations
      : undefined;

    this.eventsGateway.emitRegistrationCancelled(eventId, {
      attendeeName: registration.user.profile?.name || 'Guest',
      totalRegistrations,
      maxAttendees: registration.event.maxAttendees,
      timestamp: new Date(),
    });

    this.eventsGateway.emitAttendeesCountUpdate(eventId, {
      totalRegistrations,
      maxAttendees: registration.event.maxAttendees,
      availableSeats,
      isFull: false,
    });

    if (availableSeats && availableSeats > 0) {
      this.eventsGateway.emitAvailabilityChanged(eventId, {
        isAvailable: true,
        availableSeats,
        message: `${availableSeats} seats now available!`,
      });
    }
  }

  private async invalidateOwnerCache(ownerId: string) {
    try {
      await this.redisService.del(`dashboard:stats:${ownerId}`);
    } catch (err) {
      console.warn('Redis cache invalidation error:', err?.message || err);
    }
  }
}
