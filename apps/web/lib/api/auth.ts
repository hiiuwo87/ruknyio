/**
 * 🔐 Auth API - Authentication endpoints
 * 
 * Authentication Methods:
 * 1. QuickSign (Magic Link) - Email-based passwordless auth
 * 2. OAuth (Google/LinkedIn) - Social login
 * 
 * 🔒 Token Strategy (httpOnly Cookies):
 * - Access Token: httpOnly cookie (30 min) - sent automatically with requests
 * - Refresh Token: httpOnly cookie (30 days) - used for token refresh
 * - CSRF Token: regular cookie (readable by JS) - sent in X-CSRF-Token header
 */

import { z } from 'zod';
import api, { setCsrfToken, clearCsrfToken, setAccessToken, clearAccessToken, scheduleSilentRefresh } from './client';

// ============ Schemas ============

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  role: z.enum(['ADMIN', 'PREMIUM', 'BASIC', 'GUEST']).optional().default('BASIC'),
  emailVerified: z.boolean().optional().default(false),
  profileCompleted: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;

export const AuthResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  csrf_token: z.string().optional(), // 🔒 CSRF token for frontend
  access_token: z.string().optional(), // 🔒 Deprecated - now in httpOnly cookie
  refresh_token: z.string().optional(), // 🔒 Deprecated - now in httpOnly cookie
  user: UserSchema.optional(),
  expires_in: z.number().optional(),
  needsProfileCompletion: z.boolean().optional(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// ============ QuickSign Types ============

export const QuickSignRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type QuickSignRequest = z.infer<typeof QuickSignRequestSchema>;

export const QuickSignResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  type: z.enum(['LOGIN', 'SIGNUP']),
  expiresIn: z.number(),
});

export type QuickSignResponse = z.infer<typeof QuickSignResponseSchema>;

export const QuickSignVerifyResponseSchema = z.object({
  valid: z.boolean(),
  type: z.string().optional(),
  email: z.string().optional(),
  isNewUser: z.boolean().optional(),
  message: z.string().optional(),
  used: z.boolean().optional(),
  expired: z.boolean().optional(),
});

export type QuickSignVerifyResponse = z.infer<typeof QuickSignVerifyResponseSchema>;

// ============ QuickSign API Functions ============

/**
 * Request QuickSign magic link
 * Sends an email with a login/signup link
 */
export async function requestQuickSign(email: string): Promise<QuickSignResponse> {
  const validated = QuickSignRequestSchema.parse({ email });
  const { data } = await api.post<QuickSignResponse>('/auth/quicksign/request', validated);
  // Runtime validation with Zod schema
  return QuickSignResponseSchema.parse(data);
}

/**
 * Check QuickSign token validity (without consuming it)
 */
export async function checkQuickSignToken(token: string): Promise<QuickSignVerifyResponse> {
  const { data } = await api.get<QuickSignVerifyResponse>('/auth/quicksign/check-token', { token });
  return data;
}

/**
 * Verify QuickSign token and get auth tokens
 * Called when user clicks the magic link
 */
export async function verifyQuickSign(token: string): Promise<AuthResponse> {
  const { data } = await api.get<AuthResponse>(`/auth/quicksign/verify/${token}`);
  
  // Runtime validation with Zod schema
  const validated = AuthResponseSchema.parse(data);
  
  if (validated.access_token) {
    setAccessToken(validated.access_token);
  }
  
  return validated;
}

/**
 * Complete profile after QuickSign signup
 */
export interface CompleteProfileInput {
  name: string;
  username: string;
}

export async function completeProfile(input: CompleteProfileInput): Promise<{ success: boolean; user: User }> {
  const { data } = await api.post<{ success: boolean; user: User }>('/auth/quicksign/complete-profile', input);
  // Runtime validation - validate user object
  const validated = z.object({
    success: z.boolean(),
    user: UserSchema,
  }).parse(data);
  return validated;
}

/**
 * Update OAuth user profile (name + username)
 * Called by Google/LinkedIn users during profile completion
 */
export interface UpdateOAuthProfileInput {
  name: string;
  username: string;
  phone?: string;
}

export async function updateOAuthProfile(input: UpdateOAuthProfileInput): Promise<{
  success: boolean;
  user: User;
  message: string;
}> {
  const { data } = await api.post<{ success: boolean; user: User; message: string }>(
    '/auth/update-profile',
    input,
  );
  // Runtime validation
  const validated = z.object({
    success: z.boolean(),
    user: UserSchema,
    message: z.string(),
  }).parse(data);
  return validated;
}

/**
 * Check username availability
 */
export async function checkUsername(username: string): Promise<{ available: boolean; suggestions?: string[] }> {
  const safeUsername = encodeURIComponent(username.trim());
  const { data } = await api.get<{ available: boolean; suggestions?: string[] }>(
    `/auth/quicksign/check-username/${safeUsername}`,
  );
  // Runtime validation
  return z.object({
    available: z.boolean(),
    suggestions: z.array(z.string()).optional(),
  }).parse(data);
}

// ============ Core Auth Functions ============

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<User> {
  const { data } = await api.get<User>('/auth/me');
  // Runtime validation with Zod schema
  return UserSchema.parse(data);
}

/**
 * 🔒 Refresh access token using refresh token cookie
 * 
 * 🔒 IMPORTANT: This function uses the centralized refreshOnce() mutex
 * to ensure only ONE refresh request happens at a time, even across
 * multiple tabs or concurrent API calls.
 */
export async function refreshToken(): Promise<AuthResponse> {
  // Import refreshOnce dynamically to avoid circular dependencies
  const { refreshOnce } = await import('./client');
  
  const result = await refreshOnce();
  
  if (!result.success) {
    throw new Error('Token refresh failed');
  }
  
  return {
    success: true,
    csrf_token: result.csrfToken,
    expires_in: result.expiresIn,
    user: result.user || undefined, // 🔒 Forward user data from refresh
  };
}

/**
 * Logout current session
 */
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    // 🔒 Clear CSRF token (cookies cleared by server)
    clearCsrfToken();
  }
}

/**
 * Logout from all devices
 */
export async function logoutAll(): Promise<{ success: boolean; devicesLoggedOut: number }> {
  try {
    const { data } = await api.post<{ success: boolean; devicesLoggedOut: number }>('/auth/logout-all');
    // 🔒 Clear CSRF token
    clearCsrfToken();
    // Runtime validation
    return z.object({
      success: z.boolean(),
      devicesLoggedOut: z.number(),
    }).parse(data);
  } finally {
    clearAccessToken();
  }
}

/**
 * Get active sessions
 */
export const SessionSchema = z.object({
  id: z.string(),
  userAgent: z.string(),
  ipAddress: z.string(),
  lastActivity: z.string(),
  createdAt: z.string(),
  isCurrent: z.boolean(),
  browser: z.string().optional(),
  os: z.string().optional(),
  deviceType: z.string().optional(),
});

export type Session = z.infer<typeof SessionSchema>;

export async function getSessions(): Promise<Session[]> {
  const { data } = await api.get<Session[]>('/auth/sessions');
  // Runtime validation with Zod schema
  return z.array(SessionSchema).parse(data);
}

/**
 * Revoke a specific session
 */
export async function revokeSession(sessionId: string): Promise<{ success: boolean }> {
  const { data } = await api.delete<{ success: boolean }>(`/auth/sessions/${sessionId}`);
  // Runtime validation
  return z.object({ success: z.boolean() }).parse(data);
}

// ============ OAuth Functions ============

import { API_EXTERNAL_URL } from '@/lib/config';

/**
 * Get Google OAuth URL (external - for browser redirect)
 */
export function getGoogleAuthUrl(): string {
  return `${API_EXTERNAL_URL}/auth/google`;
}

/**
 * Get LinkedIn OAuth URL (external - for browser redirect)
 */
export function getLinkedInAuthUrl(): string {
  return `${API_EXTERNAL_URL}/auth/linkedin`;
}

/**
 * Exchange OAuth code for tokens
 * Called after OAuth redirect with one-time code
 * 
 * 🔒 MUTEX: Only ONE exchange per code - subsequent calls wait for the same promise
 */

// Global mutex for OAuth exchange
const OAUTH_EXCHANGE_KEY = '__rukny_oauth_exchange__';

interface OAuthExchangeState {
  codes: Map<string, Promise<AuthResponse>>;
  usedCodes: Set<string>;
}

function getOAuthExchangeState(): OAuthExchangeState {
  if (typeof window === 'undefined') {
    return { codes: new Map(), usedCodes: new Set() };
  }
  if (!(window as any)[OAUTH_EXCHANGE_KEY]) {
    (window as any)[OAUTH_EXCHANGE_KEY] = {
      codes: new Map<string, Promise<AuthResponse>>(),
      usedCodes: new Set<string>(),
    };
  }
  return (window as any)[OAUTH_EXCHANGE_KEY];
}

export async function exchangeOAuthCode(code: string): Promise<AuthResponse> {
  const state = getOAuthExchangeState();
  
  // 🔒 Check if code was already successfully used
  if (state.usedCodes.has(code)) {
    throw new Error('This authorization code has already been used');
  }
  
  // 🔒 MUTEX: If exchange is in progress for this code, wait for it
  const existingPromise = state.codes.get(code);
  if (existingPromise) {
    return existingPromise;
  }
  
  // Create the single promise for this code
  const exchangePromise = (async (): Promise<AuthResponse> => {
    try {
      const { data } = await api.post<AuthResponse>('/auth/oauth/exchange', { code });
      
      // Runtime validation with Zod schema
      const validated = AuthResponseSchema.parse(data);
      
      // 🔒 Mark code as used on success
      state.usedCodes.add(code);
      
      if (validated.access_token) {
        setAccessToken(validated.access_token);
      }
      if (typeof validated.expires_in === 'number') {
        scheduleSilentRefresh(validated.expires_in);
      }

      return validated;
    } finally {
      // 🔒 Clear the pending promise (allow retry on failure)
      state.codes.delete(code);
    }
  })();
  
  // Store the promise for concurrent callers
  state.codes.set(code, exchangePromise);
  
  return exchangePromise;
}

// ============ WebSocket Token ============

/**
 * Get WebSocket authentication token
 */
export async function getWebSocketToken(): Promise<{ token: string; expiresIn: number }> {
  const { data } = await api.get<{ token: string; expiresIn: number }>('/auth/ws-token');
  // Runtime validation
  return z.object({
    token: z.string(),
    expiresIn: z.number(),
  }).parse(data);
}
