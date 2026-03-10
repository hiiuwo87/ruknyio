import { cache } from 'react';
import { redirect } from 'next/navigation';
import { apiClient } from './api-client';
import { verifySession } from './session';
import type { AuthUser } from './definitions';

/**
 * Data Access Layer (DAL)
 *
 * Centralised data-fetching functions that run on the server.
 * Each function first verifies the session (via cookie), then
 * calls the backend through the BFF apiClient.
 *
 * Using React `cache()` ensures each function runs at most once
 * per request, even if multiple Server Components call it.
 */

// ─── Auth ─────────────────────────────────────────────────────

/**
 * Get the currently authenticated user.
 * Redirects to /login if no valid session.
 */
export const getUser = cache(async (): Promise<AuthUser> => {
  const hasSession = await verifySession();
  if (!hasSession) {
    redirect('/login');
  }

  const { data, error, status } = await apiClient<AuthUser>('/auth/me');

  if (status === 401 || error || !data) {
    redirect('/login');
  }

  return data;
});

/**
 * Get the current user without redirecting.
 * Returns `null` if not authenticated.
 */
export const getUserOptional = cache(async (): Promise<AuthUser | null> => {
  const hasSession = await verifySession();
  if (!hasSession) return null;

  const { data } = await apiClient<AuthUser>('/auth/me');
  return data;
});

/**
 * Ensure the user has completed their profile.
 * Redirects to /complete-profile if not.
 */
export const requireCompleteProfile = cache(async (): Promise<AuthUser> => {
  const user = await getUser();

  if (!user.profileCompleted) {
    redirect('/complete-profile');
  }

  return user;
});
