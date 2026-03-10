/**
 * 👤 Profiles API - User profile endpoints
 */

import { z } from 'zod';
import api from './client';

// ============ Schemas ============

export const ProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  username: z.string(),
  displayName: z.string().nullable(),
  bio: z.string().nullable(),
  avatar: z.string().nullable(),
  cover: z.string().nullable(),
  isPublic: z.boolean(),
  views: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const UpdateProfileInputSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  displayName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

// ============ API Functions ============

/**
 * Get current user's profile
 */
export async function getMyProfile(): Promise<Profile> {
  const { data } = await api.get<Profile>('/profiles/me');
  // Runtime validation with Zod schema
  return ProfileSchema.parse(data);
}

/**
 * Get profile by username
 */
export async function getProfileByUsername(username: string): Promise<Profile> {
  const { data } = await api.get<Profile>(`/profiles/${username}`);
  // Runtime validation with Zod schema
  return ProfileSchema.parse(data);
}

/**
 * Update current user's profile
 */
export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  const validated = UpdateProfileInputSchema.parse(input);
  const { data } = await api.patch<Profile>('/profiles/me', validated);
  // Runtime validation with Zod schema
  return ProfileSchema.parse(data);
}

import { API_URL } from '@/lib/config';

/**
 * Upload avatar to S3 via profiles endpoint
 */
export async function uploadAvatar(file: File): Promise<{ url: string; key?: string; avatarUrl?: string }> {
  const formData = new FormData();
  formData.append('file', file);
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  
  // Use /profiles/avatar endpoint which uploads to S3
  const response = await fetch(
    `${API_URL}/profiles/avatar`,
    {
      method: 'POST',
      body: formData,
      credentials: 'include',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to upload avatar');
  }

  const data = await response.json();
  // The endpoint returns { ...profile, avatarUrl } where avatarUrl is the presigned S3 URL
  // Return the avatarUrl as url for compatibility
  return { 
    url: data.avatarUrl || data.url || data.avatar,
    key: data.avatar,
    avatarUrl: data.avatarUrl,
  };
}
