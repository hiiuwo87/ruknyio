"use client";

/**
 * 🔐 Auth Callback Client — Handles OAuth callback flow
 */

import { useEffect, useState, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/providers";
import { Loader2, XCircle, ArrowRight } from "lucide-react";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handleOAuthCallback } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const exchangeAttemptedRef = useRef(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      return;
    }

    if (!code) {
      setError("No authorization code received");
      return;
    }

    if (exchangeAttemptedRef.current) return;

    const exchangeCode = async () => {
      try {
        exchangeAttemptedRef.current = true;
        const response = await handleOAuthCallback(code);

        // If the user needs to complete their profile, redirect there
        if (response.needsProfileCompletion) {
          router.push("/complete-profile");
          return;
        }

        const callbackUrl =
          sessionStorage.getItem("oauth_callback") || "/dashboard";
        sessionStorage.removeItem("oauth_callback");
        router.push(callbackUrl);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Authentication failed";
        setError(message);
      }
    };

    exchangeCode();
  }, [searchParams, handleOAuthCallback, router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
        <div className="flex w-full max-w-sm flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Authentication Failed
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {error}
          </p>
          <button
            onClick={() => router.push("/login")}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Back to Login
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="mt-4 text-sm text-muted-foreground">
        Completing sign in...
      </p>
    </div>
  );
}

export default function AuthCallbackClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
