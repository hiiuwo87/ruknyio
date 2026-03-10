import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

/**
 * Optional JWT Auth Guard
 * Does not throw if not authenticated, just sets req.user to null
 * Useful for endpoints that support both authenticated and signed URL access
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    // Don't throw if not authenticated, just return null
    return user || null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // Try to authenticate, but don't fail if token is missing
      await super.canActivate(context);
    } catch {
      // Ignore authentication errors - user just won't be set
    }
    return true; // Always allow the request to proceed
  }
}
