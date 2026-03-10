import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * 🔔 Notifications Gateway
 *
 * WebSocket gateway للإشعارات الفورية
 */
@WebSocketGateway({
  cors: {
    origin:
      process.env.NODE_ENV !== 'production'
        ? true
        : process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const userId = await this.authenticateClient(client);

    if (!userId) {
      this.logger.warn(`Unauthorized connection attempt: ${client.id}`);
      client.disconnect(true);
      return;
    }

    // إضافة للخريطة
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);

    // الانضمام لغرفة المستخدم
    client.join(`user:${userId}`);
    (client as any).userId = userId;

    this.logger.log(`Client connected: ${client.id} (User: ${userId})`);

    // إرسال عدد الإشعارات غير المقروءة
    client.emit('connected', { status: 'ok' });
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).userId;

    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id);

      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * إرسال إشعار لمستخدم
   */
  sendToUser(userId: string, notification: any): void {
    if (!this.userSockets.has(userId)) {
      this.logger.debug(`User ${userId} not connected, skipping`);
      return;
    }

    this.server.to(`user:${userId}`).emit('notification', notification);
    this.logger.debug(`Notification sent to user ${userId}`);
  }

  /**
   * إرسال تحديث عدد الإشعارات غير المقروءة
   */
  sendUnreadCount(userId: string, count: number): void {
    if (!this.userSockets.has(userId)) return;

    this.server.to(`user:${userId}`).emit('unread-count', { count });
  }

  /**
   * بث لجميع المستخدمين المتصلين
   */
  broadcast(notification: any): void {
    this.server.emit('broadcast', notification);
    this.logger.log('Broadcast notification sent');
  }

  /**
   * معالجة تحديد إشعار كمقروء
   */
  @SubscribeMessage('mark-read')
  handleMarkRead(client: Socket, payload: { notificationId: string }): void {
    const userId = (client as any).userId;
    if (!userId) return;

    // يتم التحديث عبر REST API، هنا فقط للـ real-time sync
    this.server
      .to(`user:${userId}`)
      .emit('notification-read', { id: payload.notificationId });
  }

  /**
   * معالجة تحديد الكل كمقروء
   */
  @SubscribeMessage('mark-all-read')
  handleMarkAllRead(client: Socket): void {
    const userId = (client as any).userId;
    if (!userId) return;

    this.server.to(`user:${userId}`).emit('all-read');
  }

  /**
   * الحصول على عدد المتصلين
   */
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * التحقق من اتصال مستخدم
   */
  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  // ==================== Private Methods ====================

  private async authenticateClient(client: Socket): Promise<string | null> {
    try {
      const token =
        (client.handshake.auth as any)?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return null;

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret });

      return payload.sub;
    } catch {
      return null;
    }
  }
}
