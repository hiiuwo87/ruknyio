/**
 * 🔒 Token Storage Manager
 * 
 * Safely manages token persistence in sessionStorage/localStorage
 * with expiration validation and secure handling
 */

interface StoredToken {
  token: string;
  expireAt: number; // timestamp in ms
  createdAt: number;
}

const TOKEN_STORAGE_KEY = 'profile_completion_token';
const TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const STORAGE_PREFIX = 'rukny_';

/**
 * Save token with expiration time
 */
export function saveProfileToken(token: string): void {
  if (!token || typeof window === 'undefined') return;

  try {
    const stored: StoredToken = {
      token,
      expireAt: Date.now() + TOKEN_EXPIRY_MS,
      createdAt: Date.now(),
    };
    sessionStorage.setItem(
      STORAGE_PREFIX + TOKEN_STORAGE_KEY,
      JSON.stringify(stored)
    );
  } catch (err) {
    console.warn('[TokenStorage] Failed to save token:', err);
  }
}

/**
 * Retrieve token if still valid
 * @param urlToken - Optional token from URL parameter (takes priority over stored token)
 */
export function getProfileToken(urlToken?: string | null): string | null {
  // If URL token provided, use it (don't check storage)
  if (urlToken) {
    return urlToken;
  }

  if (typeof window === 'undefined') return null;

  try {
    const stored = sessionStorage.getItem(STORAGE_PREFIX + TOKEN_STORAGE_KEY);
    if (!stored) return null;

    const parsed: StoredToken = JSON.parse(stored);

    // Check expiration
    if (Date.now() > parsed.expireAt) {
      clearProfileToken();
      return null;
    }

    return parsed.token;
  } catch (err) {
    console.warn('[TokenStorage] Failed to retrieve token:', err);
    return null;
  }
}

/**
 * Check if token still valid (without retrieving it)
 */
export function isProfileTokenValid(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const stored = sessionStorage.getItem(STORAGE_PREFIX + TOKEN_STORAGE_KEY);
    if (!stored) return false;

    const parsed: StoredToken = JSON.parse(stored);
    return Date.now() <= parsed.expireAt;
  } catch (err) {
    return false;
  }
}

/**
 * Get time remaining in minutes
 */
export function getProfileTokenTimeRemaining(): number {
  if (typeof window === 'undefined') return 0;

  try {
    const stored = sessionStorage.getItem(STORAGE_PREFIX + TOKEN_STORAGE_KEY);
    if (!stored) return 0;

    const parsed: StoredToken = JSON.parse(stored);
    const remaining = parsed.expireAt - Date.now();
    return Math.max(0, Math.floor(remaining / 60000)); // return in minutes
  } catch (err) {
    return 0;
  }
}

/**
 * Clear token from storage
 */
export function clearProfileToken(): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(STORAGE_PREFIX + TOKEN_STORAGE_KEY);
  } catch (err) {
    console.warn('[TokenStorage] Failed to clear token:', err);
  }
}
