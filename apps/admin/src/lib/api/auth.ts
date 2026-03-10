/**
 * 🔐 Admin Auth API
 */

import { buildApiPath, buildApiExternalUrl, APP_URL } from "@/lib/config";
import { setCsrfToken } from "./client";

// ---------- Types ----------

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  avatarUrl?: string;
}

interface MagicLinkResponse {
  success: boolean;
  message: string;
}

interface VerifyResponse {
  success: boolean;
  user: AdminUser;
  csrf_token?: string;
  needsProfileCompletion?: boolean;
}

interface MeResponse {
  id: string;
  email: string;
  name?: string;
  role: string;
  avatarUrl?: string;
}

// ---------- API Calls ----------

/** Send a magic link to the admin email */
export async function sendAdminMagicLink(email: string): Promise<MagicLinkResponse> {
  const res = await fetch(buildApiPath("auth/quicksign/request"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || "Failed to send magic link");
  }

  return data;
}

/** Resend magic link */
export async function resendAdminMagicLink(email: string): Promise<MagicLinkResponse> {
  const res = await fetch(buildApiPath("auth/quicksign/resend"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to resend");
  return data;
}

/** Handle OAuth callback */
export async function exchangeOAuthCode(code: string): Promise<VerifyResponse> {
  const res = await fetch(buildApiPath("auth/oauth/exchange"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "OAuth failed");

  if (data.csrf_token) {
    setCsrfToken(data.csrf_token);
  }

  return data;
}

/** Get current authenticated admin user */
export async function getAdminMe(): Promise<AdminUser> {
  const res = await fetch(buildApiPath("auth/me"), {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Not authenticated");
  }

  return res.json();
}

/** Logout */
export async function logoutAdmin(): Promise<void> {
  await fetch(buildApiPath("auth/logout"), {
    method: "POST",
    credentials: "include",
  });
}

/** Complete QuickSign profile (for magic link users) */
export async function completeQuickSignProfile(data: {
  name: string;
  username: string;
  quickSignToken: string;
}): Promise<{ success: boolean; csrf_token?: string; message?: string }> {
  const res = await fetch(buildApiPath("auth/quicksign/complete-profile"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      Array.isArray(json.message)
        ? json.message.join(", ")
        : json.message || "Failed to complete profile"
    );
  }

  return json;
}

/** Complete OAuth profile (for Google OAuth users) */
export async function completeOAuthProfile(data: {
  name: string;
  username: string;
}): Promise<{ success: boolean; user: AdminUser; message: string }> {
  const res = await fetch(buildApiPath("auth/update-profile"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      Array.isArray(json.message)
        ? json.message.join(", ")
        : json.message || "Failed to complete profile"
    );
  }

  return json;
}

/** Google OAuth URL — passes callback_url so backend redirects back to admin */
export function getGoogleAuthUrl(): string {
  return buildApiExternalUrl(`auth/google?callback_url=${encodeURIComponent(APP_URL)}`);
}
