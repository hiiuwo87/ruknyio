'use server';

import { apiClient } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────

export interface GoogleCalendarStatus {
  linked: boolean;
}

export interface GoogleCalendarAuthUrl {
  authUrl: string;
}

// ─── Get Calendar Link Status ─────────────────────────────────

export async function getGoogleCalendarStatus(): Promise<{
  data: GoogleCalendarStatus | null;
  error: string | null;
}> {
  const { data, error, status } = await apiClient<{ success: boolean; linked: boolean }>(
    '/google/calendar/status',
  );

  if (error || !data) {
    return { data: null, error: error || 'فشل في جلب حالة التقويم' };
  }

  return { data: { linked: data.linked }, error: null };
}

// ─── Get OAuth Authorization URL ──────────────────────────────

export async function getGoogleCalendarAuthUrl(returnUrl?: string): Promise<{
  data: string | null;
  error: string | null;
}> {
  const query = returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : '';
  const { data, error } = await apiClient<{ success: boolean; authUrl: string }>(
    `/google/calendar/auth${query}`,
  );

  if (error || !data) {
    return { data: null, error: error || 'فشل في الحصول على رابط التفويض' };
  }

  return { data: data.authUrl, error: null };
}

// ─── Exchange Code for Tokens ─────────────────────────────────

export async function exchangeGoogleCalendarCode(code: string): Promise<{
  data: { success: boolean; message: string } | null;
  error: string | null;
}> {
  const { data, error } = await apiClient<{ success: boolean; message: string }>(
    `/google/calendar/exchange?code=${encodeURIComponent(code)}`,
    { method: 'POST' },
  );

  if (error || !data) {
    return { data: null, error: error || 'فشل في ربط التقويم' };
  }

  return { data, error: null };
}

// ─── Unlink Google Calendar ───────────────────────────────────

export async function unlinkGoogleCalendar(): Promise<{
  data: { success: boolean } | null;
  error: string | null;
}> {
  const { data, error } = await apiClient<{ success: boolean }>(
    '/google/calendar/unlink',
    { method: 'DELETE' },
  );

  if (error || !data) {
    return { data: null, error: error || 'فشل في إلغاء الربط' };
  }

  return { data, error: null };
}
