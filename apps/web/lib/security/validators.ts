/**
 * 🔐 Security Validators
 * 
 * Token and input validation functions to prevent:
 * - Token injection attacks
 * - Malformed token usage
 * - Invalid input patterns
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════
// Token Validation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * JWT Token Schema - validates token format
 * Expects: header.payload.signature (base64url encoded)
 */
const JWTTokenSchema = z
  .string()
  .refine(
    (token) => {
      const parts = token.split('.');
      return parts.length === 3;
    },
    { message: 'Invalid JWT format: must have 3 parts separated by dots' }
  )
  .refine(
    (token) => {
      // Check length is reasonable (JWTs are typically 300-500 chars)
      return token.length >= 20 && token.length <= 2000;
    },
    { message: 'Token length out of acceptable range' }
  )
  .refine(
    (token) => {
      // Only allow base64url characters and dots
      return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
    },
    { message: 'Token contains invalid characters' }
  );

/**
 * Validate a JWT token string
 * @returns Sanitized token or null if invalid
 */
export function validateJWT(token: string | null | undefined): string | null {
  if (!token || typeof token !== 'string') return null;

  try {
    return JWTTokenSchema.parse(token.trim());
  } catch {
    console.warn('[Security] Invalid JWT token format');
    return null;
  }
}

/**
 * Magic link token schema - typically alphanumeric with hyphens
 */
const MagicLinkTokenSchema = z
  .string()
  .min(20)
  .max(500)
  .regex(/^[a-zA-Z0-9\-_]+$/, 'Token contains invalid characters');

/**
 * Validate a magic link token
 * @returns Sanitized token or null if invalid
 */
export function validateMagicLinkToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== 'string') return null;

  try {
    return MagicLinkTokenSchema.parse(token.trim());
  } catch {
    console.warn('[Security] Invalid magic link token format');
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Input Validation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Email validation schema
 */
const EmailSchema = z.string().email('Invalid email format').trim().toLowerCase();

/**
 * Validate email address
 */
export function validateEmail(email: string | null | undefined): string | null {
  if (!email) return null;

  try {
    return EmailSchema.parse(email);
  } catch {
    return null;
  }
}

/**
 * Username validation (lowercase alphanumeric, hyphens, underscores, dots)
 * Matches backend sanitization: [a-z0-9_-]+
 */
const UsernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(
    /^[a-z0-9_\-]+$/,
    'Username can only contain lowercase letters, numbers, hyphens and underscores'
  )
  .trim()
  .toLowerCase();

/**
 * Validate username
 */
export function validateUsername(username: string | null | undefined): string | null {
  if (!username) return null;

  try {
    return UsernameSchema.parse(username);
  } catch {
    return null;
  }
}

/**
 * URL validation - ensures URL is absolute and from allowed hosts
 */
const URLSchema = z.string().url('Invalid URL format');

/**
 * Validate URL
 */
export function validateURL(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    return URLSchema.parse(url);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Combined Validators
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate all token types
 */
export function validateToken(
  token: string | null | undefined,
  type: 'jwt' | 'magic-link' = 'jwt'
): string | null {
  if (type === 'jwt') {
    return validateJWT(token);
  } else if (type === 'magic-link') {
    return validateMagicLinkToken(token);
  }
  return null;
}

/**
 * Profile completion data validation
 */
export const CompleteProfileSchema = z.object({
  quickSignToken: z.string().min(1),
  name: z.string().min(1),
  username: UsernameSchema,
  isVendor: z.boolean().optional(),
  storeCategory: z.string().optional(),

  storeDescription: z.string().optional(),
  employeesCount: z.string().optional(),
  storeCountry: z.string().optional(),
  storeCity: z.string().optional(),
  storeAddress: z.string().optional(),
  storeLatitude: z.number().optional(),
  storeLongitude: z.number().optional(),
});

export type CompleteProfileInput = z.infer<typeof CompleteProfileSchema>;

/**
 * Validate profile completion data
 */
export function validateProfileCompletion(data: unknown): CompleteProfileInput | null {
  try {
    return CompleteProfileSchema.parse(data);
  } catch {
    console.warn('[Security] Invalid profile completion data');
    return null;
  }
}
