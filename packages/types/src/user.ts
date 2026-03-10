/**
 * User Types
 * 
 * Shared user-related types for frontend and backend.
 */

/**
 * Base user type (public info)
 */
export interface UserBase {
  id: string;
  username: string;
  displayName?: string | null;
  avatar?: string | null;
  bio?: string | null;
  isVerified: boolean;
  createdAt: Date | string;
}

/**
 * Full user type (authenticated user's own data)
 */
export interface User extends UserBase {
  email: string;
  phone?: string | null;
  role: UserRole;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt?: Date | string | null;
  updatedAt: Date | string;
}

/**
 * User role enum
 */
export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

/**
 * User profile update payload
 */
export interface UpdateUserProfile {
  displayName?: string;
  bio?: string;
  avatar?: string;
  phone?: string;
  location?: string;
  website?: string;
  socialLinks?: SocialLinks;
}

/**
 * Social media links
 */
export interface SocialLinks {
  twitter?: string;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  tiktok?: string;
  youtube?: string;
  website?: string;
}

/**
 * User session information
 */
export interface UserSession {
  id: string;
  userId: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date | string;
  expiresAt: Date | string;
  isCurrentSession?: boolean;
}

/**
 * Authentication tokens
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Registration payload
 */
export interface RegisterPayload {
  email: string;
  password: string;
  username: string;
  displayName?: string;
}
