/**
 * Security Decorators - Unified Export
 *
 * All security-related decorators are centralized here.
 */

import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

// Import ROLES_KEY from guards to avoid duplicate exports
import { ROLES_KEY } from '../guards';

/**
 * Roles Decorator
 * Specify which roles can access a route
 *
 * @example
 * @Roles(Role.ADMIN, Role.MODERATOR)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Public Decorator
 * Mark a route as public (no authentication required)
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Skip Throttle Decorator
 * Skip rate limiting for a route
 */
export const SKIP_THROTTLE_KEY = 'skipThrottle';
export const SkipThrottle = () => SetMetadata(SKIP_THROTTLE_KEY, true);
