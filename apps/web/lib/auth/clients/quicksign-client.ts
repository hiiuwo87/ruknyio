/**
 * 🔐 QuickSign Client
 * 
 * Client for QuickSign (Magic Link) authentication
 */

import api from '@/lib/api/client';
import { z } from 'zod';
import { UserSchema, type User } from '@/lib/api/auth';

// ============ Types ============

export interface CompleteProfileData {
  quickSignToken: string;
  name: string;
  username: string;
  isVendor?: boolean;
  storeCategory?: string;
  storeDescription?: string;
  employeesCount?: string;
  storeCountry?: string;
  storeCity?: string;
  storeAddress?: string;
  storeLatitude?: number;
  storeLongitude?: number;
}

export interface CompleteProfileResponse {
  success: boolean;
  message?: string;
  csrf_token?: string;
  expires_in?: number;
  user: User;
  store?: {
    id: string;
    name: string;
    slug: string;
  };
}

const StoreSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});

const CompleteProfileResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  csrf_token: z.string().optional(),
  expires_in: z.number().optional(),
  user: UserSchema,
  store: StoreSchema.optional(),
});

// ============ QuickSign Client ============

export const quickSignClient = {
  /**
   * Complete user profile after QuickSign verification
   * This creates the user account and optionally their store
   */
  async completeProfile(data: CompleteProfileData): Promise<CompleteProfileResponse> {
    const { data: response } = await api.post<CompleteProfileResponse>(
      '/auth/quicksign/complete-profile',
      {
        quickSignToken: data.quickSignToken,
        name: data.name,
        username: data.username,
        isVendor: data.isVendor ?? true,
        storeCategory: data.storeCategory,
        storeDescription: data.storeDescription,
        employeesCount: data.employeesCount,
        storeCountry: data.storeCountry,
        storeCity: data.storeCity,
        storeAddress: data.storeAddress,
        storeLatitude: data.storeLatitude,
        storeLongitude: data.storeLongitude,
      }
    );

    // Validate response
    const validated = CompleteProfileResponseSchema.parse(response);
    return validated;
  },

  /**
   * Verify a QuickSign token
   */
  async verifyToken(token: string): Promise<{ valid: boolean; email?: string; isNewUser?: boolean }> {
    const { data } = await api.get(`/auth/quicksign/check-token`, { token });
    return z.object({
      valid: z.boolean(),
      email: z.string().optional(),
      isNewUser: z.boolean().optional(),
    }).parse(data);
  },
};

export default quickSignClient;
