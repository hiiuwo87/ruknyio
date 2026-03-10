import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { updateSessionActivityThrottled } from '../auth/utils/session-activity.util';

@Injectable()
@WebSocketGateway({
  cors: {
    origin:
      process.env.NODE_ENV !== 'production'
        ? true // Allow all origins in development
        : process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const auth = await this.authenticate(client);
    if (!auth) {
      this.logger.warn(`Unauthorized socket connection attempt: ${client.id}`);
      client.disconnect(true);
      return;
    }

    const userId = auth.userId;
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(client.id);

    this.logger.log(
      `Client connected to /events: ${client.id} (User: ${userId})`,
    );
    client.join(`user:${userId}`);
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).userId as string | undefined;

    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(client.id);

      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.logger.log(`Client disconnected from /events: ${client.id}`);
  }

  // Subscribe to specific event updates
  @SubscribeMessage('join-event')
  handleJoinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string; role?: 'organizer' | 'attendee' },
  ) {
    const { eventId, role } = data;
    const room = `event:${eventId}`;

    client.join(room);
    this.logger.log(`Client ${client.id} joined event room: ${room}`);

    // Join role-specific room if provided
    if (role === 'organizer') {
      client.join(`${room}:organizers`);
      this.logger.log(
        `Client ${client.id} joined organizers room: ${room}:organizers`,
      );
    } else if (role === 'attendee') {
      client.join(`${room}:attendees`);
      this.logger.log(
        `Client ${client.id} joined attendees room: ${room}:attendees`,
      );
    }

    return { success: true, message: `Joined event ${eventId}` };
  }

  // Leave event room
  @SubscribeMessage('leave-event')
  handleLeaveEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { eventId: string },
  ) {
    const { eventId } = data;
    const room = `event:${eventId}`;

    client.leave(room);
    client.leave(`${room}:organizers`);
    client.leave(`${room}:attendees`);

    this.logger.log(`Client ${client.id} left event room: ${room}`);
    return { success: true, message: `Left event ${eventId}` };
  }

  // ==================== Emit Methods ====================

  /**
   * إرسال إشعار بتسجيل جديد للمنظمين
   */
  emitNewRegistration(
    eventId: string,
    data: {
      attendeeName: string;
      attendeeAvatar?: string;
      totalRegistrations: number;
      maxAttendees?: number;
      timestamp: Date;
    },
  ) {
    this.server
      .to(`event:${eventId}:organizers`)
      .emit('new-registration', data);
    this.logger.log(`New registration notification sent for event ${eventId}`);
  }

  /**
   * إرسال إشعار بإلغاء تسجيل للمنظمين
   */
  emitRegistrationCancelled(
    eventId: string,
    data: {
      attendeeName: string;
      totalRegistrations: number;
      maxAttendees?: number;
      timestamp: Date;
    },
  ) {
    this.server
      .to(`event:${eventId}:organizers`)
      .emit('registration-cancelled', data);
    this.logger.log(
      `Registration cancelled notification sent for event ${eventId}`,
    );
  }

  /**
   * تحديث عدد الأماكن المتاحة لجميع المتصفحين
   */
  emitAttendeesCountUpdate(
    eventId: string,
    data: {
      totalRegistrations: number;
      maxAttendees?: number;
      availableSeats?: number;
      isFull: boolean;
    },
  ) {
    this.server.to(`event:${eventId}`).emit('attendees-count-update', data);
    this.logger.log(
      `Attendees count update sent for event ${eventId}: ${data.totalRegistrations}/${data.maxAttendees}`,
    );
  }

  /**
   * إشعار ترقية من قائمة الانتظار
   */
  emitWaitlistPromotion(
    userId: string,
    eventId: string,
    data: {
      eventTitle: string;
      eventStartDate: Date;
      position: number;
      expiresAt: Date;
    },
  ) {
    this.server.to(`user:${userId}`).emit('waitlist-promotion', {
      ...data,
      eventId,
    });
    this.logger.log(
      `Waitlist promotion sent to user ${userId} for event ${eventId}`,
    );
  }

  /**
   * تحديث موقع في قائمة الانتظار
   */
  emitWaitlistPositionUpdate(
    userId: string,
    eventId: string,
    data: {
      position: number;
      totalWaiting: number;
    },
  ) {
    this.server.to(`user:${userId}`).emit('waitlist-position-update', {
      ...data,
      eventId,
    });
    this.logger.log(
      `Waitlist position update sent to user ${userId} for event ${eventId}`,
    );
  }

  /**
   * إشعار بتغيير حالة الحدث للمسجلين
   */
  emitEventStatusChanged(
    eventId: string,
    data: {
      status: string;
      message?: string;
      timestamp: Date;
    },
  ) {
    this.server
      .to(`event:${eventId}:attendees`)
      .emit('event-status-changed', data);
    this.logger.log(
      `Event status changed notification sent for event ${eventId}: ${data.status}`,
    );
  }

  /**
   * إشعار بتحديث تفاصيل الحدث للمسجلين
   */
  emitEventDetailsUpdated(
    eventId: string,
    data: {
      updatedFields: string[];
      changes: any;
      message?: string;
      timestamp: Date;
    },
  ) {
    this.server
      .to(`event:${eventId}:attendees`)
      .emit('event-details-updated', data);
    this.logger.log(
      `Event details updated notification sent for event ${eventId}`,
    );
  }

  /**
   * إعلان من المنظم لجميع المسجلين
   */
  emitOrganizerAnnouncement(
    eventId: string,
    data: {
      message: string;
      organizerName: string;
      timestamp: Date;
      priority?: 'low' | 'medium' | 'high';
    },
  ) {
    this.server
      .to(`event:${eventId}:attendees`)
      .emit('organizer-announcement', data);
    this.logger.log(`Organizer announcement sent for event ${eventId}`);
  }

  /**
   * تحديث إحصائيات الحدث للمنظمين
   */
  emitEventStatsUpdate(
    eventId: string,
    data: {
      totalRegistrations: number;
      confirmedAttendees: number;
      waitlistCount: number;
      checkInsCount: number;
      avgRating?: number;
      totalReviews: number;
    },
  ) {
    this.server
      .to(`event:${eventId}:organizers`)
      .emit('event-stats-update', data);
    this.logger.log(`Event stats update sent for event ${eventId}`);
  }

  /**
   * إشعار بمراجعة جديدة للمنظمين
   */
  emitNewReview(
    eventId: string,
    data: {
      reviewerName: string;
      rating: number;
      comment?: string;
      isAnonymous: boolean;
      avgRating: number;
      totalReviews: number;
      timestamp: Date;
    },
  ) {
    this.server.to(`event:${eventId}:organizers`).emit('new-review', data);
    this.logger.log(`New review notification sent for event ${eventId}`);
  }

  /**
   * إشعار بتوفر أماكن جديدة (بعد الإلغاءات)
   */
  emitAvailabilityChanged(
    eventId: string,
    data: {
      isAvailable: boolean;
      availableSeats: number;
      message: string;
    },
  ) {
    this.server.to(`event:${eventId}`).emit('availability-changed', data);
    this.logger.log(
      `Availability changed notification sent for event ${eventId}`,
    );
  }

  /**
   * إشعار بإضافة منظم جديد
   */
  emitOrganizerAdded(
    eventId: string,
    userId: string,
    data: {
      organizerName: string;
      role: string;
      invitedBy: string;
      timestamp: Date;
    },
  ) {
    // إرسال للمنظمين الآخرين
    this.server.to(`event:${eventId}:organizers`).emit('organizer-added', data);

    // إرسال للمنظم الجديد
    this.server.to(`user:${userId}`).emit('organizer-invitation', {
      ...data,
      eventId,
    });

    this.logger.log(`Organizer added notification sent for event ${eventId}`);
  }

  /**
   * إشعار بإضافة راعي جديد
   */
  emitSponsorAdded(
    eventId: string,
    data: {
      sponsorName: string;
      tier: string;
      timestamp: Date;
    },
  ) {
    this.server.to(`event:${eventId}`).emit('sponsor-added', data);
    this.logger.log(`Sponsor added notification sent for event ${eventId}`);
  }

  /**
   * إشعار بداية الحدث (قبل 15 دقيقة)
   */
  emitEventStartingSoon(
    eventId: string,
    data: {
      eventTitle: string;
      startDate: Date;
      minutesUntilStart: number;
      meetingUrl?: string;
    },
  ) {
    this.server
      .to(`event:${eventId}:attendees`)
      .emit('event-starting-soon', data);
    this.logger.log(
      `Event starting soon notification sent for event ${eventId}`,
    );
  }

  /**
   * إحصائيات حية للمنظم (لوحة التحكم)
   */
  emitLiveStats(
    eventId: string,
    data: {
      onlineAttendeesCount: number;
      activeNow: string[];
      recentActivity: any[];
    },
  ) {
    this.server.to(`event:${eventId}:organizers`).emit('live-stats', data);
  }

  // ==================== Auth Helpers ====================
  private async authenticate(
    client: Socket,
  ): Promise<{ userId: string } | null> {
    try {
      const token =
        (client.handshake.auth as any)?.token ||
        (client.handshake.headers?.authorization?.startsWith('Bearer ')
          ? client.handshake.headers.authorization.substring(7)
          : undefined);

      if (!token) return null;

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret });

      // Check if this is a WebSocket-specific token
      if (payload.type === 'ws_token' && payload.purpose === 'websocket') {
        // WS tokens are short-lived and don't have session storage
        (client as any).userId = payload.sub;
        return { userId: payload.sub };
      }

      // Validate session using sessionId (sid) from JWT
      const sessionId = payload.sid;
      if (!sessionId) {
        return null;
      }
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
      });
      if (!session || session.userId !== payload.sub || session.isRevoked) {
        return null;
      }

      // Attach userId to socket for later use
      (client as any).userId = payload.sub;
      // Update last activity with throttling to prevent slow queries
      updateSessionActivityThrottled(this.prisma, session.id);

      return { userId: payload.sub };
    } catch {
      return null;
    }
  }
}
