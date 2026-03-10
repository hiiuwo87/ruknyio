'use client';

/**
 * ⏰ Session Timeout Warning Component
 * 
 * Shows a warning dialog when the user's session is about to expire,
 * allowing them to extend the session or log out.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, RefreshCw, LogOut } from 'lucide-react';
import { getCsrfToken, clearCsrfToken, refreshOnce, getSessionExpiresAtMs } from '@/lib/api/client';
import { toast } from '@/components/toast-provider';

interface SessionTimeoutWarningProps {
  /** Warning shown X seconds before expiry (default: 60) */
  warningTime?: number;
  /** Check interval in seconds (default: 30) */
  checkInterval?: number;
  /** Enable the feature (default: true) */
  enabled?: boolean;
}

// Auth pages and public pages where session timeout should NOT trigger
const AUTH_PAGES = [
  '/', // Landing page (public)
  '/login',
  '/register',
  '/quicksign',
  '/complete-profile',
  '/auth/verify',
  '/auth/callback',
  '/forgot-password',
  '/reset-password',
];

export function SessionTimeoutWarning({
  warningTime = 60,
  checkInterval = 30,
  enabled = true,
}: SessionTimeoutWarningProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const checkRef = useRef<NodeJS.Timeout | null>(null);

  // Check if current page is an auth page or public page (should skip session check)
  const isAuthPage = useCallback(() => {
    if (typeof window === 'undefined') return true; // SSR - skip check
    const pathname = window.location.pathname;
    // Check exact match for root, or startsWith for other paths
    return AUTH_PAGES.some(page => 
      page === '/' ? pathname === '/' : pathname.startsWith(page)
    );
  }, []);

  // Check if session is about to expire
  const checkSession = useCallback(() => {
    // 🔒 Skip session check on auth pages and public pages
    if (isAuthPage()) {
      setShowWarning(false);
      return;
    }

    // Tokens are httpOnly now; JS can't decode JWT.
    // We use CSRF token presence + refresh metadata to estimate expiry.
    const csrf = getCsrfToken();
    if (!csrf) {
      setShowWarning(false);
      return;
    }

    const expiresAt = getSessionExpiresAtMs();
    if (!expiresAt) {
      // We don't know expiry yet (e.g. first page load before refresh/login)
      setShowWarning(false);
      return;
    }

    const now = Date.now();
    const remaining = Math.floor((expiresAt - now) / 1000); // Seconds

    if (remaining <= 0) {
      // Token already expired - only logout if not on public pages
      setShowWarning(false);
      if (!isAuthPage()) {
        handleLogout();
      } else {
        clearCsrfToken();
      }
      return;
    }

    if (remaining <= warningTime && remaining > 0) {
      // Show warning
      setTimeLeft(remaining);
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
  }, [warningTime, isAuthPage]);

  // Countdown effect
  useEffect(() => {
    if (showWarning && timeLeft > 0) {
      countdownRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setShowWarning(false);
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      };
    }
  }, [showWarning, timeLeft]);

  // Periodic check
  useEffect(() => {
    if (!enabled) return;

    // Initial check
    checkSession();

    // Set up periodic check
    checkRef.current = setInterval(checkSession, checkInterval * 1000);

    return () => {
      if (checkRef.current) {
        clearInterval(checkRef.current);
      }
    };
  }, [enabled, checkInterval, checkSession]);

  // Extend session by refreshing token
  // 🔒 Uses centralized refreshOnce() mutex - NO direct fetch!
  const handleExtendSession = async () => {
    setIsRefreshing(true);
    try {
      const result = await refreshOnce();

      if (result.success) {
        setShowWarning(false);
        toast.success('تم تمديد الجلسة');
      } else {
        toast.error('فشل تمديد الجلسة');
        handleLogout();
      }
    } catch {
      toast.error('فشل تمديد الجلسة');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Logout - only redirect if not already on an auth page
  const handleLogout = () => {
    // 🔒 Don't redirect to login if already on auth pages
    if (isAuthPage()) {
      setShowWarning(false);
      return;
    }
    clearCsrfToken();
    setShowWarning(false);
    window.location.href = '/login?session=expired';
  };

  // Format time left
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}`;
  };

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-200"
        role="alertdialog"
        aria-labelledby="session-warning-title"
        aria-describedby="session-warning-desc"
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
            <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        {/* Title */}
        <h2
          id="session-warning-title"
          className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2"
        >
          جلستك على وشك الانتهاء
        </h2>

        {/* Description */}
        <p
          id="session-warning-desc"
          className="text-center text-gray-600 dark:text-gray-400 mb-6"
        >
          سيتم تسجيل خروجك تلقائياً خلال
        </p>

        {/* Countdown */}
        <div className="flex justify-center mb-6">
          <div className="text-5xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / warningTime) * 100}%` }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleExtendSession}
            disabled={isRefreshing}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isRefreshing ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            تمديد الجلسة
          </button>
          <button
            onClick={handleLogout}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionTimeoutWarning;
