import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * 🔒 WebSocket Token Service
 *
 * خدمة إنشاء والتحقق من توكنز WebSocket
 * تُستخدم لتأمين اتصالات WebSocket
 */
@Injectable()
export class WebSocketTokenService {
  private readonly WS_TOKEN_EXPIRY = '5m'; // 5 دقائق - قصير المدة للأمان

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * 🔒 إنشاء توكن WebSocket
   * يُستخدم لتأمين اتصال WebSocket الأولي
   */
  generateWebSocketToken(userId: string): string {
    const payload = {
      sub: userId,
      type: 'ws_token',
      purpose: 'websocket',
      jti: crypto.randomUUID(), // Unique token ID
    };

    return this.jwtService.sign(payload, {
      expiresIn: this.WS_TOKEN_EXPIRY,
    });
  }

  /**
   * 🔒 إنشاء توكن (alias للتوافق)
   */
  generateToken(userId: string): string {
    return this.generateWebSocketToken(userId);
  }

  /**
   * 🔒 التحقق من توكن WebSocket
   */
  verifyWebSocketToken(token: string): {
    valid: boolean;
    userId?: string;
    error?: string;
  } {
    try {
      const payload = this.jwtService.verify(token);

      if (payload.type !== 'ws_token' || payload.purpose !== 'websocket') {
        return { valid: false, error: 'Invalid token type' };
      }

      return {
        valid: true,
        userId: payload.sub,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message || 'Token verification failed',
      };
    }
  }

  /**
   * 🔒 استخراج توكن من query string أو headers
   */
  extractTokenFromHandshake(handshake: {
    query?: { token?: string };
    headers?: { authorization?: string };
  }): string | null {
    // من query string
    if (handshake.query?.token) {
      return handshake.query.token;
    }

    // من Authorization header
    if (handshake.headers?.authorization) {
      const [type, token] = handshake.headers.authorization.split(' ');
      if (type === 'Bearer' && token) {
        return token;
      }
    }

    return null;
  }
}
