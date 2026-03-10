import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma/prisma.service';
import { updateSessionActivityThrottled } from '../../domain/auth/utils/session-activity.util';

@Injectable()
@WebSocketGateway({
  cors: {
    origin:
      process.env.NODE_ENV !== 'production'
        ? true // Allow all origins in development
        : process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/security',
})
export class SecurityGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SecurityGateway.name);
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

    this.logger.log(`Client connected: ${client.id} (User: ${userId})`);
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

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // إرسال سجل أمني جديد لمستخدم معين
  emitSecurityLog(userId: string, log: any) {
    // 🔒 التحقق من أن المستخدم متصل فعلياً
    if (!this.userSockets.has(userId)) {
      this.logger.debug(`User ${userId} not connected, skipping emit`);
      return;
    }
    this.server.to(`user:${userId}`).emit('new-security-log', log);
    this.logger.log(`Security log sent to user ${userId}: ${log.action}`);
  }

  // إرسال تحديث لإحصائيات الأمان
  emitSecurityStats(userId: string, stats: any) {
    // 🔒 التحقق من أن المستخدم متصل فعلياً
    if (!this.userSockets.has(userId)) {
      return;
    }
    this.server.to(`user:${userId}`).emit('security-stats-update', stats);
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
