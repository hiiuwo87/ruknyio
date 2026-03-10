'use server';

import { revalidatePath } from 'next/cache';
import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────

export interface ProfileData {
  id: string;
  userId: string;
  username: string;
  name: string;
  bio: string | null;
  avatar: string | null;
  coverImage: string | null;
  visibility: 'PUBLIC' | 'PRIVATE';
  hideEmail: boolean;
  hidePhone: boolean;
  hideLocation: boolean;
  location: string | null;
  storageUsed: number;
  storageLimit: number;
  user: {
    id: string;
    email: string;
    phone: string | null;
    twoFactorEnabled: boolean;
    googleId: string | null;
    linkedinId: string | null;
    isDeactivated: boolean;
    deactivatedAt: string | null;
  };
  socialLinks: Array<{
    id: string;
    platform: string;
    url: string;
    title: string | null;
  }>;
}

export interface UserProfile {
  id: string;
  email: string;
  phone: string | null;
  role: string;
  twoFactorEnabled: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  profile: {
    name: string;
    username: string;
    avatar: string | null;
    bio: string | null;
    coverImage: string | null;
  } | null;
}

export interface SessionData {
  id: string;
  deviceName: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  location: string | null;
  lastActivity: string;
  createdAt: string;
  isCurrent: boolean;
}

// ─── Profile Settings ─────────────────────────────────────────

/**
 * Get current user's full profile (for settings page)
 */
export async function getMyProfile(): Promise<{
  data: ProfileData | null;
  error: string | null;
}> {
  const { data, error } = await apiClient<ProfileData>('/profiles/me');
  return { data, error };
}

/**
 * Get the user-level profile (email, phone, 2FA status)
 */
export async function getUserProfile(): Promise<{
  data: UserProfile | null;
  error: string | null;
}> {
  const { data, error } = await apiClient<UserProfile>('/user/profile');
  return { data, error };
}

/**
 * Update profile info (name, username, bio, visibility, privacy, location)
 */
export async function updateProfile(profileData: {
  name?: string;
  username?: string;
  bio?: string;
  visibility?: 'PUBLIC' | 'PRIVATE';
  hideEmail?: boolean;
  hidePhone?: boolean;
  hideLocation?: boolean;
  location?: string;
}): Promise<{ data: ProfileData | null; error: string | null }> {
  const { data, error } = await apiClient<ProfileData>('/profiles', {
    method: 'PUT',
    body: JSON.stringify(profileData),
  });

  if (!error) {
    revalidatePath('/app/settings');
    revalidatePath('/app');
  }

  return { data, error };
}

/**
 * Upload avatar image
 */
export async function uploadAvatar(
  formData: FormData,
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await apiClient<any>('/profiles/avatar', {
    method: 'POST',
    body: formData,
    // Don't set Content-Type - let browser set multipart boundary
  });

  if (!error) {
    revalidatePath('/app/settings');
    revalidatePath('/app');
  }

  return { data, error };
}

/**
 * Upload cover image
 */
export async function uploadCover(
  formData: FormData,
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await apiClient<any>('/profiles/cover', {
    method: 'POST',
    body: formData,
  });

  if (!error) {
    revalidatePath('/app/settings');
    revalidatePath('/app');
  }

  return { data, error };
}

/**
 * Check username availability
 */
export async function checkUsernameAvailability(
  username: string,
): Promise<{ available: boolean; error: string | null }> {
  const { data, error } = await apiClient<{ available: boolean }>(
    `/profiles/check/${username}`,
    { skipCookies: true, skipCsrf: true },
  );
  return { available: data?.available ?? false, error };
}

// ─── Account & Security ───────────────────────────────────────

/**
 * Request email change (requires admin approval)
 */
export async function changeEmail(
  newEmail: string,
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await apiClient<any>('/user/change-email', {
    method: 'PATCH',
    body: JSON.stringify({ newEmail }),
  });

  if (!error) {
    revalidatePath('/app/settings/account');
  }

  return { data, error };
}

/**
 * Get email change request status
 */
export interface EmailChangeRequestData {
  id: string;
  oldEmail: string;
  newEmail: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export async function getEmailChangeRequest(): Promise<{
  data: EmailChangeRequestData | null;
  error: string | null;
}> {
  const { data, error } = await apiClient<EmailChangeRequestData>(
    '/user/email-change-request',
  );
  return { data, error };
}

/**
 * Cancel pending email change request
 */
export async function cancelEmailChangeRequest(): Promise<{
  data: any;
  error: string | null;
}> {
  const { data, error } = await apiClient<any>('/user/email-change-request', {
    method: 'DELETE',
  });

  if (!error) {
    revalidatePath('/app/settings/account');
  }

  return { data, error };
}

/**
 * Send email verification code
 */
export async function sendEmailVerification(): Promise<{
  data: any;
  error: string | null;
}> {
  const { data, error } = await apiClient<any>('/user/send-email-verification', {
    method: 'POST',
  });
  return { data, error };
}

/**
 * Verify email with code
 */
export async function verifyEmailCode(
  code: string,
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await apiClient<any>('/user/verify-email', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

  if (!error) {
    revalidatePath('/app/settings/account');
  }

  return { data, error };
}

/**
 * Setup 2FA - get QR code
 */
export async function setup2FA(): Promise<{
  data: { secret: string; qrCode: string } | null;
  error: string | null;
}> {
  const { data, error } = await apiClient<{ secret: string; qrCode: string }>(
    '/user/2fa/setup',
    { method: 'POST' },
  );
  return { data, error };
}

/**
 * Verify and enable 2FA
 */
export async function verify2FA(
  code: string,
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await apiClient<any>('/user/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

  if (!error) {
    revalidatePath('/app/settings/account');
  }

  return { data, error };
}

/**
 * Disable 2FA
 */
export async function disable2FA(
  code: string,
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await apiClient<any>('/user/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });

  if (!error) {
    revalidatePath('/app/settings/account');
  }

  return { data, error };
}

// ─── Sessions ─────────────────────────────────────────────────

/**
 * Get all active sessions
 */
export async function getSessions(): Promise<{
  data: SessionData[] | null;
  error: string | null;
}> {
  const { data, error } = await apiClient<SessionData[]>('/user/sessions');
  return { data, error };
}

/**
 * Delete a specific session
 */
export async function deleteSession(
  sessionId: string,
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await apiClient<any>(
    `/user/sessions/${sessionId}`,
    { method: 'DELETE' },
  );

  if (!error) {
    revalidatePath('/app/settings/account');
  }

  return { data, error };
}

/**
 * Delete all other sessions
 */
export async function deleteAllOtherSessions(): Promise<{
  data: any;
  error: string | null;
}> {
  const { data, error } = await apiClient<any>('/user/sessions', {
    method: 'DELETE',
  });

  if (!error) {
    revalidatePath('/app/settings/account');
  }

  return { data, error };
}

// ─── Account Management ──────────────────────────────────────

/**
 * Deactivate account temporarily
 */
export async function deactivateAccount(
  reason?: string,
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await apiClient<any>('/user/deactivate', {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });

  return { data, error };
}

/**
 * Reactivate account
 */
export async function reactivateAccount(): Promise<{
  data: any;
  error: string | null;
}> {
  const { data, error } = await apiClient<any>('/user/reactivate', {
    method: 'PATCH',
  });

  if (!error) {
    revalidatePath('/app');
  }

  return { data, error };
}

/**
 * Delete account permanently
 */
export async function deleteAccountPermanently(
  confirmation: string,
  reason?: string,
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await apiClient<any>('/user/account', {
    method: 'DELETE',
    body: JSON.stringify({ confirmation, reason }),
  });

  return { data, error };
}

// ─── Banner Slider ────────────────────────────────────────────

export interface BannerItem {
  key: string;
  url: string;
}

/**
 * Get user's banner images (presigned URLs)
 */
export async function getBanners(): Promise<{
  data: BannerItem[] | null;
  error: string | null;
}> {
  const { data, error } = await apiClient<{ keys: string[]; urls: string[] }>('/upload/banners');
  if (error || !data) return { data: null, error };

  const banners: BannerItem[] = (data.keys || []).map((key, i) => ({
    key,
    url: data.urls[i],
  }));
  return { data: banners, error: null };
}

/**
 * Upload banner images (server-side via multipart)
 */
export async function uploadBanners(
  formData: FormData,
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await apiClient<any>('/upload/banners', {
    method: 'POST',
    body: formData,
  });

  if (!error) {
    revalidatePath('/app/settings/store');
  }

  return { data, error };
}

/**
 * Delete banner images by keys
 */
export async function deleteBanners(
  keys: string[],
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await apiClient<any>('/upload/banners/delete', {
    method: 'POST',
    body: JSON.stringify({ keys }),
  });

  if (!error) {
    revalidatePath('/app/settings/store');
  }

  return { data, error };
}

// ─── Store Settings ───────────────────────────────────────────

export interface StoreData {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  banner: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  city: string | null;
  country: string;
  categoryId: string | null;
  category: string | null;
  status: string;
}

/**
 * Get current user's store
 */
export async function getMyStore(): Promise<{
  data: StoreData | null;
  error: string | null;
}> {
  const { data, error } = await apiClient<StoreData>('/stores/my-store');
  return { data, error };
}

/**
 * Update store settings
 */
export async function updateStore(
  storeId: string,
  storeData: {
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    city?: string;
  },
): Promise<{ data: StoreData | null; error: string | null }> {
  const { data, error } = await apiClient<StoreData>(`/stores/${storeId}`, {
    method: 'PUT',
    body: JSON.stringify(storeData),
  });

  if (!error) {
    revalidatePath('/app/settings/store');
  }

  return { data, error };
}
