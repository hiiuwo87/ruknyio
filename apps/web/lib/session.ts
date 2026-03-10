import { cookies } from 'next/headers';
import { cache } from 'react';

/**
 * Verify the current session by checking for the access_token cookie.
 *
 * In the BFF pattern, the real JWT lives in an httpOnly cookie that
 * Next.js middleware and server code can read. We don't decode the
 * JWT here — we let the backend /auth/me endpoint validate it.
 *
 * Returns `true` if the access_token cookie exists (session likely valid).
 * A missing token means the user is not authenticated.
 */
export const verifySession = cache(async (): Promise<boolean> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token');
  return !!accessToken?.value;
});

/**
 * Check whether the browser request has an access_token cookie.
 * Useful in middleware where you need a sync-ish check.
 */
export function hasSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.includes('access_token=');
}
