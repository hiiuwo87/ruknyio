'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { apiClient } from '@/lib/api-client';
import {
  CompleteProfileSchema,
  type CompleteProfileFormState,
} from '@/lib/definitions';
import { getCountryByCode } from '@/lib/countries';

// ─── Complete Profile ────────────────────────────────────────

/**
 * Handles profile completion for BOTH flows:
 * - QuickSign users: have a quickSignToken → POST /auth/quicksign/complete-profile
 * - OAuth users: already have session cookies → POST /auth/update-profile
 */
export async function completeProfile(
  quickSignToken: string,
  _prevState: CompleteProfileFormState,
  formData: FormData,
): Promise<CompleteProfileFormState> {
  const parsed = CompleteProfileSchema.safeParse({
    name: formData.get('name'),
    username: formData.get('username'),
    storeCategory: formData.get('storeCategory') || undefined,
    storeDescription: formData.get('storeDescription') || undefined,
    employeesCount: formData.get('employeesCount') || undefined,
    storeCountry: formData.get('storeCountry') || undefined,
    storeCity: formData.get('storeCity') || undefined,
    storeAddress: formData.get('storeAddress') || undefined,
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: 'يرجى تصحيح الأخطاء أدناه',
    };
  }

  // Determine which endpoint to use based on whether we have a quickSignToken
  const isQuickSign = !!quickSignToken;

  if (isQuickSign) {
    // Convert country/region codes to Arabic labels for the backend
    const countryData = parsed.data.storeCountry
      ? getCountryByCode(parsed.data.storeCountry)
      : undefined;
    const countryLabel = countryData?.label || parsed.data.storeCountry;
    const regionLabel = parsed.data.storeCity && countryData
      ? countryData.regions.find((r) => r.value === parsed.data.storeCity)?.label || parsed.data.storeCity
      : parsed.data.storeCity;

    // QuickSign flow — token-based, no session yet
    const { data, error } = await apiClient<{ user: unknown }>(
      '/auth/quicksign/complete-profile',
      {
        method: 'POST',
        body: JSON.stringify({
          ...parsed.data,
          storeCountry: countryLabel,
          storeCity: regionLabel,
          quickSignToken,
        }),
      },
    );

    if (error) {
      return { message: error };
    }
  } else {
    // OAuth flow — user already has session cookies (JWT)
    const { data, error } = await apiClient<{ user: unknown }>(
      '/auth/update-profile',
      {
        method: 'POST',
        body: JSON.stringify({
          name: parsed.data.name,
          username: parsed.data.username,
        }),
      },
    );

    if (error) {
      return { message: error };
    }
  }

  // Bust any cached page data before redirecting
  revalidatePath('/app');
  revalidatePath('/complete-profile');
  redirect('/app');
}

// ─── Check Username Availability ─────────────────────────────

export async function checkUsername(username: string): Promise<{
  available: boolean;
  error?: string;
}> {
  if (!username || username.length < 3) {
    return { available: false, error: 'اسم المستخدم قصير جداً' };
  }

  const { data, error } = await apiClient<{ available: boolean }>(
    `/auth/quicksign/check-username/${encodeURIComponent(username)}`,
    { method: 'GET' },
  );

  if (error) {
    return { available: false, error };
  }

  return { available: data?.available ?? false };
}

// ─── Update Profile (for already-registered users) ───────────

export async function updateProfile(profileData: {
  name?: string;
  username?: string;
  avatar?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await apiClient('/auth/update-profile', {
    method: 'POST',
    body: JSON.stringify(profileData),
  });

  if (error) {
    return { success: false, error };
  }

  return { success: true };
}
