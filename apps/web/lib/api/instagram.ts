/**
 * Instagram Integration API
 */

import api from './client';
import { API_EXTERNAL_URL } from '@/lib/config';

// ============ Types ============

export interface InstagramConnection {
  igUserId: string;
  username: string;
  name: string | null;
  profilePicUrl: string | null;
  followersCount: number | null;
  tokenExpiry: string | null;
  createdAt: string;
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url: string;
  thumbnail_url?: string;
  timestamp: string;
  permalink: string;
  like_count?: number;
  comments_count?: number;
}

export interface InstagramGridLink {
  id: string;
  blockId: string;
  mediaId: string;
  linkUrl: string | null;
  linkTitle: string | null;
}

export interface InstagramBlock {
  id: string;
  userId: string;
  type: 'GRID' | 'FEED';
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  gridLinks: InstagramGridLink[];
}

// ============ API Functions ============

/** Get Instagram connection status */
export async function getInstagramStatus(): Promise<{
  connected: boolean;
  connection: InstagramConnection | null;
}> {
  const res = await api.get<{ connected: boolean; connection: InstagramConnection | null }>(
    '/integrations/instagram/status',
  );
  return res.data;
}

/** Get Instagram auth URL (redirects to OAuth) */
export function getInstagramAuthUrl(): string {
  return `${API_EXTERNAL_URL}/integrations/instagram/auth`;
}

/** Fetch Instagram media */
export async function getInstagramMedia(limit = 12): Promise<{ data: InstagramMedia[] }> {
  const res = await api.get<{ data: InstagramMedia[] }>(
    '/integrations/instagram/media',
    { limit },
  );
  return res.data;
}

/** Connect Instagram manually with an access token */
export async function connectInstagramManual(
  accessToken: string,
): Promise<{ success: boolean; username?: string }> {
  const res = await api.post<{ success: boolean; username?: string }>(
    '/integrations/instagram/manual-connect',
    { accessToken },
  );
  return res.data;
}

/** Disconnect Instagram */
export async function disconnectInstagram(): Promise<void> {
  await api.delete('/integrations/instagram');
}

/** Create an Instagram block */
export async function createInstagramBlock(type: 'GRID' | 'FEED'): Promise<InstagramBlock> {
  const res = await api.post<InstagramBlock>('/integrations/instagram/blocks', { type });
  return res.data;
}

/** Get user's Instagram blocks */
export async function getInstagramBlocks(): Promise<InstagramBlock[]> {
  const res = await api.get<InstagramBlock[]>('/integrations/instagram/blocks');
  return res.data;
}

/** Get public Instagram blocks + media for a user */
export async function getPublicInstagramData(userId: string): Promise<{
  blocks: InstagramBlock[];
  media: { data: InstagramMedia[] } | null;
}> {
  const res = await api.get<{
    blocks: InstagramBlock[];
    media: { data: InstagramMedia[] } | null;
  }>(`/integrations/instagram/blocks/public/${userId}`);
  return res.data;
}

/** Toggle block active state */
export async function toggleInstagramBlock(blockId: string): Promise<InstagramBlock> {
  const res = await api.patch<InstagramBlock>(
    `/integrations/instagram/blocks/${blockId}/toggle`,
  );
  return res.data;
}

/** Delete a block */
export async function deleteInstagramBlock(blockId: string): Promise<void> {
  await api.delete(`/integrations/instagram/blocks/${blockId}`);
}

/** Set a grid link */
export async function setInstagramGridLink(
  blockId: string,
  mediaId: string,
  linkUrl: string,
  linkTitle?: string,
): Promise<InstagramGridLink> {
  const res = await api.post<InstagramGridLink>(
    `/integrations/instagram/blocks/${blockId}/grid-links`,
    { mediaId, linkUrl, linkTitle },
  );
  return res.data;
}

/** Remove a grid link */
export async function removeInstagramGridLink(
  blockId: string,
  mediaId: string,
): Promise<void> {
  await api.delete(`/integrations/instagram/blocks/${blockId}/grid-links/${mediaId}`);
}
