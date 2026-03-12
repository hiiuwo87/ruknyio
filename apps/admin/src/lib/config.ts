/**
 * ⚙️ Admin Panel Configuration
 *
 * API URL Strategy:
 * - API_URL: Relative path (/api/v1) for fetch requests (uses Next.js rewrites/proxy)
 *   → Keeps cookies same-origin so httpOnly access_token is always sent.
 * - API_EXTERNAL_URL: Full URL for browser redirects (OAuth, magic links)
 */

const runtimeAppUrl =
  typeof window !== "undefined" ? window.location.origin : undefined;

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || runtimeAppUrl || "http://localhost:3002";

/** Relative path — goes through Next.js proxy (see next.config.ts rewrites) */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

/** Absolute URL — only used for browser redirects (OAuth, magic links) */
export const API_EXTERNAL_URL =
  process.env.NEXT_PUBLIC_API_EXTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3001/api/v1";

/** Build an absolute API path for fetch requests */
export function buildApiPath(path: string): string {
  const clean = path.replace(/^\/+/, "");
  return `${API_URL}/${clean}`;
}

/** Build external API URL for browser redirects */
export function buildApiExternalUrl(path: string): string {
  const clean = path.replace(/^\/+/, "");
  return `${API_EXTERNAL_URL}/${clean}`;
}

// ---------- Admin Whitelist ----------

/**
 * Allowed admin emails.
 * Add emails here or set NEXT_PUBLIC_ADMIN_EMAILS env var (comma-separated).
 */
const envAdmins = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",").map((e) => e.trim().toLowerCase()) ?? [];

export const ADMIN_EMAILS: string[] = [
  "support@rukny.io",
  ...envAdmins,
];

/** Check if an email is in the admin whitelist */
export function isAllowedAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

// ---------- Allowed Roles ----------

export const ADMIN_ROLES = ["admin", "superadmin", "ADMIN", "SUPERADMIN", "SUPER_ADMIN"];

export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role);
}

export const config = {
  api: {
    url: API_URL,
    buildPath: buildApiPath,
  },
  app: {
    name: "Rukny Admin",
    description: "Admin dashboard for Rukny platform",
  },
} as const;

export default config;
