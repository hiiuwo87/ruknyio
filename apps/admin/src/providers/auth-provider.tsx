"use client";

/**
 * 🔐 Admin Auth Provider
 *
 * Manages authentication state for the admin panel.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  type AdminUser,
  sendAdminMagicLink,
  getAdminMe,
  logoutAdmin,
  exchangeOAuthCode,
} from "@/lib/api/auth";
import { setCsrfToken, clearCsrfToken, resetRefreshState, refreshAccessToken } from "@/lib/api/client";
import { isAllowedAdmin, isAdminRole } from "@/lib/config";

interface AuthContextValue {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sendMagicLink: (email: string) => Promise<void>;
  handleOAuthCallback: (code: string) => Promise<{ needsProfileCompletion?: boolean }>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check current session on mount + verify admin access
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 🔒 Try refresh first - it returns user data, skipping separate /auth/me call
        const refreshResult = await refreshAccessToken();
        let me: AdminUser;

        if (refreshResult.ok && refreshResult.user) {
          me = refreshResult.user;
        } else {
          // Fallback to /auth/me if refresh didn't return user
          me = await getAdminMe();
        }

        // Verify the user is an authorized admin
        if (!isAllowedAdmin(me.email) && !isAdminRole(me.role)) {
          if (!cancelled) {
            setError("Access denied. You are not authorized as an admin.");
            // ⚠️ لا نستدعي logoutAdmin() لأن ذلك يحذف كوكيز المستخدم العادي
            // فقط نمسح الحالة المحلية بدون مسح الجلسة من السيرفر
          }
          return;
        }
        if (!cancelled) setUser(me);
      } catch {
        // Not logged in — that's okay
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    setError(null);

    // Double-check whitelist at provider level
    if (!isAllowedAdmin(email)) {
      const msg = "Access denied. This email is not authorized for admin access.";
      setError(msg);
      throw new Error(msg);
    }

    setIsLoading(true);
    try {
      await sendAdminMagicLink(email);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send link";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleOAuthCallback = useCallback(async (code: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await exchangeOAuthCode(code);
      if (res.csrf_token) setCsrfToken(res.csrf_token);

      // Verify admin access after OAuth
      if (!isAllowedAdmin(res.user.email) && !isAdminRole(res.user.role)) {
        // ⚠️ لا نستدعي logoutAdmin() لأن ذلك يحذف كوكيز المستخدم العادي
        throw new Error("Access denied. This account is not authorized for admin access.");
      }

      setUser(res.user);
      return { needsProfileCompletion: res.needsProfileCompletion };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OAuth failed";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutAdmin();
    } finally {
      setUser(null);
      clearCsrfToken();
      resetRefreshState();
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        sendMagicLink,
        handleOAuthCallback,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AdminAuthProvider");
  return ctx;
}

export function useUser() {
  return useAuth().user;
}

export function useIsAuthenticated() {
  return useAuth().isAuthenticated;
}
