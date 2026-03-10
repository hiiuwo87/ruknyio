import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Extract user ID from JWT token if available (optional authentication)
 * Returns userId or undefined if no valid token is present
 */
export const OptionalUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return undefined;
    }

    try {
      const token = authHeader.split(' ')[1];
      const jwtService = new JwtService({
        secret: process.env.JWT_SECRET || 'your-secret-key-here',
      });
      const payload = jwtService.verify(token);
      return payload.sub || payload.id;
    } catch (error) {
      // Token is invalid or expired, but this is optional auth, so just return undefined
      return undefined;
    }
  },
);
