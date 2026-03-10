/**
 * Security Guards - Unified Export
 *
 * All authentication and authorization guards are centralized here.
 * Import from this file for consistent security across the application.
 *
 * @example
 * import { JwtAuthGuard, RolesGuard, OwnerGuard } from '@infrastructure/security/guards';
 */

// Re-export from core/common/guards for backward compatibility
// These will be moved here in future refactoring

export {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
} from '../../../core/common/guards/auth/jwt-auth.guard';
export { GoogleAuthGuard } from '../../../core/common/guards/auth/google-auth.guard';
export { LinkedInAuthGuard } from '../../../core/common/guards/auth/linkedin-auth.guard';
export { RolesGuard, ROLES_KEY } from '../../../core/common/guards/roles.guard';
export {
  OwnerGuard,
  CheckOwnership,
  OWNERSHIP_KEY,
} from '../../../core/common/guards/owner.guard';
export { ThrottlerUserGuard } from '../../../core/common/guards/throttler-user.guard';
