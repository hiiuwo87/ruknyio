import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { RedisService } from '../../core/cache/redis.service';
import { EmailService } from '../../integrations/email/email.service';
import { GoogleCalendarService } from '../../integrations/google-calendar/google-calendar.service';
import { RegistrationStatus } from '@prisma/client';

@Injectable()
export class RegistrationsService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private googleCalendarService: GoogleCalendarService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Create a new registration for an event
   */
  async createRegistration(
    userId: string,
    eventId: string,
    registrationData?: any,
  ) {
    // Check if event exists
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            googleCalendarLinked: true,
            googleAccessToken: true,
            googleRefreshToken: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Check if user already registered
    const existingRegistration = await this.prisma.eventRegistration.findFirst({
      where: {
        eventId,
        userId,
      },
    });

    if (existingRegistration) {
      throw new BadRequestException(
        'You are already registered for this event',
      );
    }

    // Check if event has reached capacity
    if (event.maxAttendees) {
      const registrationsCount = await this.prisma.eventRegistration.count({
        where: {
          eventId,
          status: RegistrationStatus.CONFIRMED,
        },
      });

      if (registrationsCount >= event.maxAttendees) {
        throw new BadRequestException('Event has reached maximum capacity');
      }
    }

    // Get user details
    const attendee = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!attendee) {
      throw new NotFoundException('User not found');
    }

    // Create registration
    const registration = await this.prisma.eventRegistration.create({
      data: {
        eventId,
        userId,
        status: RegistrationStatus.CONFIRMED,
        ...registrationData,
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
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            venue: true,
            googleCalendarId: true,
            googleCalendarSync: true,
          },
        },
      },
    });

    // Send confirmation email
    try {
      await this.emailService.sendEventRegistrationConfirmation(
        attendee.email,
        attendee.profile?.name || 'Guest',
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
    } catch (error) {
      console.error('Failed to send registration confirmation email:', error);
      // Don't fail the registration if email fails
    }

    // Add attendee to Google Calendar if organizer has linked account
    if (
      event.user.googleCalendarLinked &&
      event.googleCalendarId &&
      event.googleCalendarSync
    ) {
      try {
        await this.addAttendeeToGoogleCalendar(
          event.user,
          event.googleCalendarId,
          attendee.email,
          attendee.profile?.name || 'Guest',
        );
      } catch (error) {
        console.error('Failed to add attendee to Google Calendar:', error);
        // Don't fail the registration if Google Calendar fails
      }
    }

    // Invalidate dashboard cache for organizer
    try {
      const ownerId = event.user?.id || event.userId;
      if (ownerId) {
        await this.redisService.del(`dashboard:stats:${ownerId}`);
      }
    } catch (err) {
      console.warn(
        'Redis del error (registrations.create):',
        err?.message || err,
      );
    }

    return registration;
  }

  /**
   * Update registration status
   */
  async updateRegistrationStatus(
    registrationId: string,
    status: RegistrationStatus,
    userId: string,
  ) {
    const registration = await this.prisma.eventRegistration.findUnique({
      where: { id: registrationId },
      include: {
        event: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    // Check if user is the event organizer
    if (registration.event.userId !== userId) {
      throw new ForbiddenException(
        'You are not authorized to update this registration',
      );
    }

    // Update status
    const updatedRegistration = await this.prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { status },
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
    });

    // Send email notification based on status
    try {
      if (status === RegistrationStatus.CONFIRMED) {
        await this.emailService.sendEventRegistrationConfirmation(
          registration.user.email,
          registration.user.profile?.name || 'Guest',
          {
            eventTitle: registration.event.title,
            startDate: registration.event.startDate,
            endDate: registration.event.endDate,
            location: registration.event.location,
            isVirtual: registration.event.isVirtual,
            meetingUrl: registration.event.meetingUrl,
            organizerName: registration.event.user.profile?.name || 'Organizer',
          },
        );
      } else if (status === RegistrationStatus.CANCELLED) {
        // You can create a cancellation email template
        console.log('Send cancellation email to:', registration.user.email);
      }
    } catch (error) {
      console.error('Failed to send status update email:', error);
    }

    // Update Google Calendar attendee status
    if (
      registration.event.user.googleCalendarLinked &&
      registration.event.googleCalendarId &&
      registration.event.googleCalendarSync
    ) {
      try {
        if (status === RegistrationStatus.CANCELLED) {
          await this.removeAttendeeFromGoogleCalendar(
            registration.event.user,
            registration.event.googleCalendarId,
            registration.user.email,
          );
        }
      } catch (error) {
        console.error('Failed to update Google Calendar attendee:', error);
      }
    }

    return updatedRegistration;
  }

  /**
   * Delete a registration
   */
  async deleteRegistration(registrationId: string, userId: string) {
    const registration = await this.prisma.eventRegistration.findUnique({
      where: { id: registrationId },
      include: {
        event: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!registration) {
      throw new NotFoundException('Registration not found');
    }

    // Check if user is the registrant or event organizer
    if (
      registration.userId !== userId &&
      registration.event.userId !== userId
    ) {
      throw new ForbiddenException(
        'You are not authorized to delete this registration',
      );
    }

    // Remove from Google Calendar
    if (
      registration.event.user.googleCalendarLinked &&
      registration.event.googleCalendarId &&
      registration.event.googleCalendarSync
    ) {
      try {
        await this.removeAttendeeFromGoogleCalendar(
          registration.event.user,
          registration.event.googleCalendarId,
          registration.user.email,
        );
      } catch (error) {
        console.error('Failed to remove attendee from Google Calendar:', error);
      }
    }

    await this.prisma.eventRegistration.delete({
      where: { id: registrationId },
    });

    return { success: true, message: 'Registration deleted successfully' };
  }

  /**
   * Add attendee to Google Calendar event
   */
  private async addAttendeeToGoogleCalendar(
    organizer: any,
    googleCalendarId: string,
    attendeeEmail: string,
    attendeeName: string,
  ) {
    try {
      await this.googleCalendarService.addAttendeeToEvent(
        organizer.googleAccessToken,
        organizer.googleRefreshToken,
        organizer.id,
        googleCalendarId,
        {
          email: attendeeEmail,
          displayName: attendeeName,
          responseStatus: 'needsAction',
        },
      );
    } catch (error) {
      console.error('Error adding attendee to Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Remove attendee from Google Calendar event
   */
  private async removeAttendeeFromGoogleCalendar(
    organizer: any,
    googleCalendarId: string,
    attendeeEmail: string,
  ) {
    try {
      await this.googleCalendarService.removeAttendeeFromEvent(
        organizer.googleAccessToken,
        organizer.googleRefreshToken,
        organizer.id,
        googleCalendarId,
        attendeeEmail,
      );
    } catch (error) {
      console.error('Error removing attendee from Google Calendar:', error);
      throw error;
    }
  }

  /**
   * Get all registrations for an event
   */
  async getEventRegistrations(eventId: string, userId: string) {
    // Check if event exists and user is the organizer
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
    });
  }
}
