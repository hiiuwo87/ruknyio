import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleCalendarService {
  private oauth2Client;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.oauth2Client = new google.auth.OAuth2(
      this.config.get('GOOGLE_CALENDAR_CLIENT_ID'),
      this.config.get('GOOGLE_CALENDAR_CLIENT_SECRET'),
      this.config.get('GOOGLE_CALENDAR_REDIRECT_URI'),
    );
  }

  /**
   * Generate Google OAuth URL for calendar authorization
   * @param state - Optional state for redirect after auth
   * @param userEmail - Optional: User's email to auto-select Google account (login_hint)
   */
  getAuthUrl(state?: string, userEmail?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar',
    ];

    const authOptions: any = {
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force to get refresh token
      state: state || 'default', // Pass state for redirect after auth
    };

    // Add login_hint if user email is provided
    if (userEmail) {
      authOptions.login_hint = userEmail;
    }

    return this.oauth2Client.generateAuthUrl(authOptions);
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, userId: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      // Save tokens to user record
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token,
          googleTokenExpiry: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : null,
          googleCalendarLinked: true,
        },
        select: {
          id: true,
          googleAccessToken: true,
          googleRefreshToken: true,
          googleTokenExpiry: true,
          googleCalendarLinked: true,
        },
      });

      return { success: true, message: 'تم ربط Google Calendar بنجاح' };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new BadRequestException('فشل في ربط Google Calendar');
    }
  }

  /**
   * Refresh access token if expired
   */
  private async refreshAccessToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        googleAccessToken: true,
        googleRefreshToken: true,
        googleTokenExpiry: true,
      },
    });

    if (!user?.googleRefreshToken) {
      throw new UnauthorizedException('لم يتم ربط Google Calendar');
    }

    // Check if token is expired or about to expire (5 minutes buffer)
    const now = new Date();
    const expiryWithBuffer = new Date(user.googleTokenExpiry);
    expiryWithBuffer.setMinutes(expiryWithBuffer.getMinutes() - 5);

    if (now < expiryWithBuffer) {
      // Token still valid
      return user.googleAccessToken;
    }

    // Refresh token
    this.oauth2Client.setCredentials({
      refresh_token: user.googleRefreshToken,
    });

    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      // Update tokens in database
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: credentials.access_token,
          googleTokenExpiry: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : null,
        },
        select: {
          id: true,
          googleAccessToken: true,
          googleTokenExpiry: true,
        },
      });

      return credentials.access_token;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new UnauthorizedException(
        'فشل في تجديد صلاحية Google Calendar. الرجاء إعادة الربط',
      );
    }
  }

  /**
   * Get authenticated calendar client
   */
  private async getCalendarClient(userId: string) {
    const accessToken = await this.refreshAccessToken(userId);

    this.oauth2Client.setCredentials({
      access_token: accessToken,
    });

    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Create event in Google Calendar with Meet link
   */
  async createCalendarEvent(userId: string, eventId: string) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
        include: { user: true },
      });

      if (!event) {
        throw new BadRequestException('الفعالية غير موجودة');
      }

      if (event.userId !== userId) {
        throw new UnauthorizedException('غير مصرح لك بهذه العملية');
      }

      const calendar = await this.getCalendarClient(userId);

      // Prepare event data for Google Calendar
      const googleEvent: calendar_v3.Schema$Event = {
        summary: event.title,
        description: event.description || '',
        start: {
          dateTime: event.startDate.toISOString(),
          timeZone: 'Asia/Baghdad',
        },
        end: {
          dateTime: event.endDate.toISOString(),
          timeZone: 'Asia/Baghdad',
        },
        location: event.isVirtual
          ? 'Online Event'
          : event.location && event.venue
            ? `${event.venue}, ${event.location}`
            : event.location || event.venue || '',

        // Create Google Meet conference
        conferenceData: {
          createRequest: {
            requestId: `rukny-${eventId}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },

        // Add attendees (optional - can be added later)
        // attendees: [],

        // Reminders
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 60 }, // 1 hour before
          ],
        },
      };

      // Create event in Google Calendar
      const response = await calendar.events.insert({
        calendarId: 'primary',
        conferenceDataVersion: 1, // Required for creating Meet link
        requestBody: googleEvent,
      });

      const createdEvent = response.data;
      const meetLink =
        createdEvent.hangoutLink ||
        createdEvent.conferenceData?.entryPoints?.[0]?.uri;

      // Update event in our database
      await this.prisma.event.update({
        where: { id: eventId },
        data: {
          googleCalendarId: createdEvent.id,
          googleMeetLink: meetLink,
          googleCalendarSync: true,
          meetingUrl: meetLink, // Also update meetingUrl field
        },
      });

      return {
        success: true,
        googleCalendarId: createdEvent.id,
        googleMeetLink: meetLink,
        htmlLink: createdEvent.htmlLink,
        message: 'تم إنشاء الحدث في Google Calendar بنجاح',
      };
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new BadRequestException(
        error.message || 'فشل في إنشاء الحدث في Google Calendar',
      );
    }
  }

  /**
   * Update existing Google Calendar event
   */
  async updateCalendarEvent(userId: string, eventId: string) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new BadRequestException('الفعالية غير موجودة');
      }

      if (event.userId !== userId) {
        throw new UnauthorizedException('غير مصرح لك بهذه العملية');
      }

      if (!event.googleCalendarId) {
        throw new BadRequestException('الفعالية غير مرتبطة مع Google Calendar');
      }

      const calendar = await this.getCalendarClient(userId);

      const googleEvent: calendar_v3.Schema$Event = {
        summary: event.title,
        description: event.description || '',
        start: {
          dateTime: event.startDate.toISOString(),
          timeZone: 'Asia/Baghdad',
        },
        end: {
          dateTime: event.endDate.toISOString(),
          timeZone: 'Asia/Baghdad',
        },
        location: event.isVirtual
          ? 'Online Event'
          : event.location && event.venue
            ? `${event.venue}, ${event.location}`
            : event.location || event.venue || '',
      };

      await calendar.events.update({
        calendarId: 'primary',
        eventId: event.googleCalendarId,
        requestBody: googleEvent,
      });

      return {
        success: true,
        message: 'تم تحديث الحدث في Google Calendar بنجاح',
      };
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw new BadRequestException('فشل في تحديث الحدث في Google Calendar');
    }
  }

  /**
   * Delete Google Calendar event
   */
  async deleteCalendarEvent(userId: string, eventId: string) {
    try {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new BadRequestException('الفعالية غير موجودة');
      }

      if (event.userId !== userId) {
        throw new UnauthorizedException('غير مصرح لك بهذه العملية');
      }

      if (!event.googleCalendarId) {
        return {
          success: true,
          message: 'الفعالية غير مرتبطة مع Google Calendar',
        };
      }

      const calendar = await this.getCalendarClient(userId);

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: event.googleCalendarId,
      });

      // Update event in database
      await this.prisma.event.update({
        where: { id: eventId },
        data: {
          googleCalendarId: null,
          googleMeetLink: null,
          googleCalendarSync: false,
        },
      });

      return {
        success: true,
        message: 'تم حذف الحدث من Google Calendar بنجاح',
      };
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw new BadRequestException('فشل في حذف الحدث من Google Calendar');
    }
  }

  /**
   * Unlink Google Calendar from user account
   */
  async unlinkGoogleCalendar(userId: string) {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: null,
          googleRefreshToken: null,
          googleTokenExpiry: null,
          googleCalendarLinked: false,
        },
        select: {
          id: true,
          googleAccessToken: true,
          googleRefreshToken: true,
          googleTokenExpiry: true,
          googleCalendarLinked: true,
        },
      });

      return {
        success: true,
        message: 'تم فصل Google Calendar بنجاح',
      };
    } catch (error) {
      console.error('Error unlinking Google Calendar:', error);
      throw new BadRequestException('فشل في فصل Google Calendar');
    }
  }

  /**
   * Check if user has Google Calendar linked
   */
  async isGoogleCalendarLinked(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { googleCalendarLinked: true },
    });

    return user?.googleCalendarLinked || false;
  }

  /**
   * Add attendee to Google Calendar event
   */
  async addAttendeeToEvent(
    accessToken: string,
    refreshToken: string,
    userId: string,
    googleCalendarId: string,
    attendee: {
      email: string;
      displayName?: string;
      responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
    },
  ) {
    try {
      // Setup OAuth2 client with tokens
      this.oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      const calendar = google.calendar({
        version: 'v3',
        auth: this.oauth2Client,
      });

      // Get current event
      const currentEvent = await calendar.events.get({
        calendarId: 'primary',
        eventId: googleCalendarId,
      });

      // Prepare attendee object
      const newAttendee: any = {
        email: attendee.email,
        responseStatus: attendee.responseStatus || 'needsAction',
      };

      if (attendee.displayName) {
        newAttendee.displayName = attendee.displayName;
      }

      // Check if attendee already exists
      const existingAttendees = currentEvent.data.attendees || [];
      const attendeeExists = existingAttendees.some(
        (a) => a.email?.toLowerCase() === attendee.email.toLowerCase(),
      );

      if (attendeeExists) {
        console.log('Attendee already exists in event');
        return { success: true, message: 'Attendee already exists' };
      }

      // Add new attendee to existing attendees
      const updatedAttendees = [...existingAttendees, newAttendee];

      // Update event with new attendee
      await calendar.events.patch({
        calendarId: 'primary',
        eventId: googleCalendarId,
        requestBody: {
          attendees: updatedAttendees,
        },
        sendUpdates: 'all', // Send email invitations
      });

      return {
        success: true,
        message: 'تم إضافة الحاضر بنجاح',
      };
    } catch (error) {
      console.error('Error adding attendee to Google Calendar event:', error);
      throw new BadRequestException('فشل في إضافة الحاضر إلى Google Calendar');
    }
  }

  /**
   * Remove attendee from Google Calendar event
   */
  async removeAttendeeFromEvent(
    accessToken: string,
    refreshToken: string,
    userId: string,
    googleCalendarId: string,
    attendeeEmail: string,
  ) {
    try {
      // Setup OAuth2 client with tokens
      this.oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      const calendar = google.calendar({
        version: 'v3',
        auth: this.oauth2Client,
      });

      // Get current event
      const currentEvent = await calendar.events.get({
        calendarId: 'primary',
        eventId: googleCalendarId,
      });

      // Filter out the attendee to remove
      const existingAttendees = currentEvent.data.attendees || [];
      const updatedAttendees = existingAttendees.filter(
        (a) => a.email?.toLowerCase() !== attendeeEmail.toLowerCase(),
      );

      if (existingAttendees.length === updatedAttendees.length) {
        console.log('Attendee not found in event');
        return { success: true, message: 'Attendee not found' };
      }

      // Update event without the removed attendee
      await calendar.events.patch({
        calendarId: 'primary',
        eventId: googleCalendarId,
        requestBody: {
          attendees: updatedAttendees,
        },
        sendUpdates: 'all', // Send cancellation emails
      });

      return {
        success: true,
        message: 'تم حذف الحاضر بنجاح',
      };
    } catch (error) {
      console.error(
        'Error removing attendee from Google Calendar event:',
        error,
      );
      throw new BadRequestException('فشل في حذف الحاضر من Google Calendar');
    }
  }

  /**
   * Get all attendees for a Google Calendar event
   */
  async getEventAttendees(
    accessToken: string,
    refreshToken: string,
    userId: string,
    googleCalendarId: string,
  ) {
    try {
      // Setup OAuth2 client with tokens
      this.oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      const calendar = google.calendar({
        version: 'v3',
        auth: this.oauth2Client,
      });

      // Get event
      const event = await calendar.events.get({
        calendarId: 'primary',
        eventId: googleCalendarId,
      });

      return {
        success: true,
        attendees: event.data.attendees || [],
      };
    } catch (error) {
      console.error(
        'Error getting attendees from Google Calendar event:',
        error,
      );
      throw new BadRequestException(
        'فشل في الحصول على الحضور من Google Calendar',
      );
    }
  }
}
