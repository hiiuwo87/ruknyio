/**
 * 🔌 Admin API Client
 *
 * Lightweight fetch wrapper for the admin panel.
 * - Automatic CSRF handling
 * - Token refresh
 * - Typed responses
 */

import { API_URL } from "@/lib/config";

// ---------- Types ----------

export class ApiException extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: string[],
  ) {
    super(message);
    this.name = "ApiException";
  }
}

interface RequestConfig extends Omit<RequestInit, "body"> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

interface ApiResponse<T> {
  data: T;
  status: number;
}

// ---------- URL Builder ----------

function buildUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const baseUrl = API_URL.endsWith("/") ? API_URL.slice(0, -1) : API_URL;
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const fullPath = `${baseUrl}${path}`;

  if (!params || Object.keys(params).length === 0) return fullPath;

  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join("&");

  return qs ? `${fullPath}?${qs}` : fullPath;
}

// ---------- CSRF ----------

let csrfToken: string | null = null;

export function getCsrfToken(): string | null {
  if (typeof window === "undefined") return null;
  if (csrfToken) return csrfToken;
  const match = document.cookie.match(
    /(?:^|; )(?:__Secure-)?csrf_token=([^;]*)/,
  );
  if (match) {
    csrfToken = match[1];
    return csrfToken;
  }
  return null;
}

export function setCsrfToken(token: string): void {
  if (!token) return;
  csrfToken = token;
  if (typeof window === "undefined") return;
  const isSecure = window.location.protocol === "https:";
  const parts = [
    `csrf_token=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${24 * 60 * 60}`,
    "SameSite=Lax",
  ];
  if (isSecure) parts.push("Secure");
  document.cookie = parts.join("; ");
}

export function clearCsrfToken(): void {
  csrfToken = null;
  if (typeof window === "undefined") return;
  document.cookie = "csrf_token=; Path=/; Max-Age=0; SameSite=Lax";
}

// ---------- Refresh ----------

let refreshPromise: Promise<{ ok: boolean; user?: any }> | null = null;

export function resetRefreshState(): void {
  refreshPromise = null;
}

export async function refreshAccessToken(): Promise<{ ok: boolean; user?: any }> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return { ok: false };
      const data = await res.json();
      if (data.success && data.csrf_token) {
        setCsrfToken(data.csrf_token);
        return { ok: true, user: data.user || null };
      }
      return { ok: false };
    } catch {
      return { ok: false };
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ---------- Core Fetch ----------

async function apiClient<T>(
  endpoint: string,
  config: RequestConfig = {},
): Promise<ApiResponse<T>> {
  const {
    body,
    params,
    headers: customHeaders,
    method = "GET",
    ...rest
  } = config;

  const url = buildUrl(endpoint, params);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string>),
  };

  const token = getCsrfToken();
  if (token && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers["X-CSRF-Token"] = token;
  }

  let response = await fetch(url, {
    ...rest,
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  // Auto-refresh on 401
  if (response.status === 401) {
    const result = await refreshAccessToken();
    if (result.ok) {
      const newToken = getCsrfToken();
      if (newToken && method !== "GET") {
        headers["X-CSRF-Token"] = newToken;
      }
      response = await fetch(url, {
        ...rest,
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include",
      });
    }
  }

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg = Array.isArray(responseData.message)
      ? responseData.message.join(", ")
      : responseData.message || "An error occurred";
    throw new ApiException(
      response.status,
      msg,
      Array.isArray(responseData.message) ? responseData.message : undefined,
    );
  }

  return { data: responseData as T, status: response.status };
}

// ---------- Public API ----------

export const api = {
  get: <T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
  ) => apiClient<T>(endpoint, { method: "GET", params }),

  post: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: "POST", body }),

  put: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: "PUT", body }),

  patch: <T>(endpoint: string, body?: unknown) =>
    apiClient<T>(endpoint, { method: "PATCH", body }),

  delete: <T>(endpoint: string) =>
    apiClient<T>(endpoint, { method: "DELETE" }),
};

export default api;
