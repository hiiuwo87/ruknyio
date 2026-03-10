"use client";

/**
 * 🔐 Admin Complete Profile Page
 *
 * Shown when a new admin user signs up via magic link or OAuth
 * and needs to set their name and username before accessing the dashboard.
 */

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildApiPath } from "@/lib/config";
import { setCsrfToken } from "@/lib/api/client";
import {
  completeQuickSignProfile,
  completeOAuthProfile,
} from "@/lib/api/auth";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  User,
  AtSign,
  ArrowRight,
  Shield,
} from "lucide-react";

// ── Sanitize helpers ────────────────────────────────────────────────
function sanitizeName(text: string): string {
  return text
    .replace(/[<>{}[\]\\]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 50);
}

function sanitizeUsername(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
}

function sanitizeToken(token: string): string {
  return token.replace(/[^a-zA-Z0-9._\-]/g, "").slice(0, 2048);
}

// ── Username availability hook ──────────────────────────────────────
function useUsernameCheck() {
  const [status, setStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "error"
  >("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const check = useCallback((username: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!username || username.length < 3) {
      setStatus("idle");
      return;
    }

    setStatus("checking");

    timerRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          buildApiPath(`auth/quicksign/check-username/${username}`),
          { credentials: "include", signal: ctrl.signal },
        );
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data = await res.json();
        setStatus(data.available ? "available" : "taken");
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setStatus("error");
      }
    }, 400);
  }, []);

  return { status, check };
}

// ── Main form ───────────────────────────────────────────────────────
function CompleteProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailParam = searchParams.get("email") || "";
  const tokenParam = searchParams.get("token") || "";

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isOAuthFlow, setIsOAuthFlow] = useState(false);

  const { status: usernameStatus, check: checkUsername } = useUsernameCheck();

  // Detect flow type: QuickSign (has token) or OAuth (no token)
  useEffect(() => {
    if (!tokenParam) {
      // OAuth flow - user should already have session cookies
      setIsOAuthFlow(true);
    } else {
      // QuickSign flow - requires email and token
      if (!emailParam) {
        router.replace("/login");
      }
    }
  }, [emailParam, tokenParam, router]);

  // Username availability check on change
  useEffect(() => {
    checkUsername(username);
  }, [username, checkUsername]);

  const canSubmit =
    name.trim().length >= 2 &&
    username.length >= 3 &&
    usernameStatus === "available" &&
    !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (isOAuthFlow) {
        // OAuth flow: user already authenticated via cookies
        const data = await completeOAuthProfile({
          name: name.trim(),
          username,
        });

        // OAuth doesn't return csrf_token (already set during OAuth exchange)
        setSuccess(true);
      } else {
        // QuickSign flow: use token to complete profile
        const data = await completeQuickSignProfile({
          name: name.trim(),
          username,
          quickSignToken: sanitizeToken(tokenParam),
        });

        // Set CSRF token from response
        if (data.csrf_token) {
          setCsrfToken(data.csrf_token);
        }

        setSuccess(true);
      }

      // Redirect to dashboard after a brief pause
      setTimeout(() => {
        router.push("/dashboard");
      }, 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success state ──
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex w-full max-w-sm flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Profile Created
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Redirecting to dashboard…
          </p>
          <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Complete Your Profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isOAuthFlow
              ? "Set up your admin account to continue"
              : `Set up your admin account for ${emailParam}`}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Full Name
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                <User className="h-4 w-4 text-muted-foreground" />
              </span>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(sanitizeName(e.target.value))}
                className="h-11 w-full rounded-lg border border-input bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-colors"
                placeholder="Your full name"
                required
                minLength={2}
                maxLength={50}
                disabled={isSubmitting}
                autoFocus
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              Username
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                <AtSign className="h-4 w-4 text-muted-foreground" />
              </span>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                className={`h-11 w-full rounded-lg border bg-background pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 transition-colors ${
                  usernameStatus === "available"
                    ? "border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                    : usernameStatus === "taken"
                      ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                      : "border-input focus:border-ring focus:ring-ring/20"
                }`}
                placeholder="admin_username"
                required
                minLength={3}
                maxLength={30}
                disabled={isSubmitting}
              />
              {/* Status indicator */}
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === "checking" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {usernameStatus === "available" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                {usernameStatus === "taken" && (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
              </span>
            </div>
            {/* Hint text */}
            <p className="mt-1.5 text-xs text-muted-foreground">
              {usernameStatus === "taken"
                ? "This username is already taken"
                : usernameStatus === "available"
                  ? "Username is available"
                  : "Letters, numbers, and underscores only"}
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating profile…
              </>
            ) : (
              <>
                Continue to Dashboard
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          This area is restricted to authorized administrators only.
        </p>
      </div>
    </div>
  );
}

// ── Page wrapper ────────────────────────────────────────────────────
export default function CompleteProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CompleteProfileContent />
    </Suspense>
  );
}
