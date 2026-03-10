'use server';

import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────

export interface StorageUsage {
  used: number;
  limit: number;
  available: number;
  percentage: number;
  files: number;
  trashUsed: number;
  categoryBreakdown: Record<string, number>;
}

// ─── Get Storage Usage ────────────────────────────────────────

export async function getStorageUsage(): Promise<{
  data: StorageUsage | null;
  error: string | null;
}> {
  const { data, error } = await apiClient<StorageUsage>('/storage/usage');

  if (error || !data) {
    return { data: null, error: error || 'فشل في جلب بيانات التخزين' };
  }

  return { data, error: null };
}
