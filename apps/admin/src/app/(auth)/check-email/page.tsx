"use client";

/**
 * 📧 Check Email Page — Waiting for magic link
 */

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Mail, Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { buildApiPath } from "@/lib/config";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") || "";

  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  useEffect(() => {
    if (!email) router.replace("/login");
  }, [email, router]);

  const handleResend = async () => {
    if (!canResend || resending) return;
    setResending(true);
    setResendSuccess(false);
    setResendError("");

    try {
      const res = await fetch(buildApiPath("auth/quicksign/resend"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendSuccess(true);
        setCanResend(false);
        setCountdown(60);
      } else {
        setResendError(data.message || "Failed to resend. Try again later.");
      }
    } catch {
      setResendError("Failed to resend. Try again later.");
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm text-center">

        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Check your email
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a sign-in link to
        </p>
        <p className="mt-1 text-sm font-medium text-foreground">{email}</p>

        {/* Resend */}
        <div className="mt-8">
          {resendSuccess && (
            <p className="mb-3 text-sm text-emerald-600">
              Link resent successfully!
            </p>
          )}
          {resendError && (
            <p className="mb-3 text-sm text-destructive">{resendError}</p>
          )}

          <button
            onClick={handleResend}
            disabled={!canResend || resending}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {resending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {canResend
              ? "Resend link"
              : `Resend in ${countdown}s`}
          </button>
        </div>

        {/* Back */}
        <button
          onClick={() => router.replace("/login")}
          className="mt-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to login
        </button>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
