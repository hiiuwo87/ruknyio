import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import {
  NotificationsService,
  CreateNotificationDto,
} from './notifications.service';
import { NotificationType } from '@prisma/client';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

@Injectable()
@WebSocketGateway({
  cors: {
    origin:
      process.env.NODE_ENV !== 'production'
        ? true // Allow all origins in development
        : process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Initialize Redis adapter for horizontal scaling and reliable broadcasting
   */
  async afterInit(server: Server) {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');

      // Skip Redis adapter if no Redis URL configured (single-instance mode)
      if (!redisUrl) {
        this.logger.warn(
          'No REDIS_URL configured - running in single-instance mode without Redis adapter',
        );
        return;
      }

      const pub = new Redis(redisUrl, { lazyConnect: true });
      const sub = new Redis(redisUrl, { lazyConnect: true });

      // Connect both instances
      await Promise.all([pub.connect(), sub.connect()]);

      server.adapter(createAdapter(pub, sub));
      this.logger.log(`Socket.IO Redis adapter connected: ${redisUrl}`);
    } catch (err: any) {
      // Don't crash - just run without Redis adapter (single-instance)
      this.logger.warn(
        `Redis adapter unavailable, running in single-instance mode: ${err?.message || err}`,
      );
    }
  }

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
      `Client connected to /notifications: ${client.id} (User: ${userId})`,
    );
    client.join(`user:${userId}`);

    // Send unread count on connect
    const unreadCount = await this.notificationsService.getUnreadCount(userId);
    client.emit('unread-count', { count: unreadCount });
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).userId as string | undefined;

    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(client.id);

      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.logger.log(`Client disconnected from /notifications: ${client.id}`);
  }

  /**
   * Send notification to a user (saves to DB and emits via WebSocket)
   */
  async sendNotification(dto: CreateNotificationDto): Promise<void> {
    try {
      // Save to database
      const notification = await this.notificationsService.create(dto);

      // Emit via WebSocket
      this.server
        .to(`user:${dto.userId}`)
        .emit('new-notification', notification);

      // Also emit updated unread count
      const unreadCount = await this.notificationsService.getUnreadCount(
        dto.userId,
      );
      this.server
        .to(`user:${dto.userId}`)
        .emit('unread-count', { count: unreadCount });

      this.logger.log(`Notification sent to user ${dto.userId}: ${dto.type}`);
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendNotificationToMany(
    userIds: string[],
    notification: Omit<CreateNotificationDto, 'userId'>,
  ): Promise<void> {
    for (const userId of userIds) {
      await this.sendNotification({ ...notification, userId });
    }
  }

  /**
   * Emit real-time event without saving to DB (for transient updates)
   */
  emitToUser(userId: string, event: string, data: any): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return (
      this.userSockets.has(userId) && this.userSockets.get(userId).size > 0
    );
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
        // Just verify the token is valid and extract userId
        (client as any).userId = payload.sub;
        return { userId: payload.sub };
      }

      // For regular tokens, validate session using sessionId (sid) from JWT
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

      return { userId: payload.sub };
    } catch {
      return null;
    }
  }
}
