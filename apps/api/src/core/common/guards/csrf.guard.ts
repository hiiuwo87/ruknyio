import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { validateCsrfToken } from '../../../domain/auth/cookie.config';

/**
 * 🔒 CSRF Protection Guard
 * 
 * Validates CSRF token for state-changing requests
 * - Token must be sent in X-CSRF-Token header
 * - Must match the csrf_token cookie
 * 
 * Usage:
 * @UseGuards(CsrfGuard)
 * @Post('sensitive-action')
 * async sensitiveAction() { ... }
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Skip CSRF validation for safe methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(request.method.toUpperCase())) {
      return true;
    }
    
    // Skip in development if CSRF_SKIP is set
    if (process.env.NODE_ENV !== 'production' && process.env.CSRF_SKIP === 'true') {
      return true;
    }
    
    const validation = validateCsrfToken(request);
    
    if (!validation.valid) {
      throw new ForbiddenException(`CSRF validation failed: ${validation.reason}`);
    }
    
    return true;
  }
}
