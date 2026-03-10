"use client";

/**
 * 🔐 Admin Login Page — Magic Link Authentication
 */

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers";
import { getGoogleAuthUrl } from "@/lib/api/auth";
import { resetRefreshState } from "@/lib/api/client";
import { isAllowedAdmin } from "@/lib/config";
import { Mail, ArrowRight, Loader2, Shield } from "lucide-react";

// ---------- Google Icon ----------
function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" {...props}>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.655 32.656 29.255 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917Z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691 12.88 19.51C14.655 15.108 18.962 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.197l-6.191-5.238C29.184 35.091 26.715 36 24 36c-5.234 0-9.62-3.318-11.282-7.946l-6.525 5.026C9.505 39.556 16.227 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.08 12.08 0 0 1-4.085 5.565l.003-.002 6.191 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.651-.389-3.917Z"
      />
    </svg>
  );
}

// ---------- Login Form ----------
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sendMagicLink, isLoading, error, clearError, isAuthenticated, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const sessionParam = searchParams.get("session");
    if (sessionParam === "expired") {
      setSessionMessage("Your session has expired. Please sign in again.");
    } else if (sessionParam === "invalid") {
      setSessionMessage("Invalid session. Please sign in again.");
    }
    resetRefreshState();
  }, [searchParams]);

  if (authLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSessionMessage(null);

    // Frontend whitelist check
    if (!isAllowedAdmin(email)) {
      setSessionMessage("Access denied. This email is not authorized for admin access.");
      return;
    }

    try {
      await sendMagicLink(email);
      router.push(`/check-email?email=${encodeURIComponent(email)}`);
    } catch {
      // handled by provider
    }
  };

  const handleGoogleLogin = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("oauth_callback", "/dashboard");
    }
    window.location.href = getGoogleAuthUrl();
  };

  const displayError = sessionMessage || error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Rukny Admin
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to the admin dashboard
          </p>
        </div>

        {/* Error */}
        {displayError && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center text-sm text-destructive">
            {displayError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Email address
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-colors"
                placeholder="Supervisor email address"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending link...
              </>
            ) : (
              <>
                Continue with Email
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-input bg-background text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          This area is restricted to authorized administrators only.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
