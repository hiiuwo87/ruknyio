"use client";

/**
 * 🔐 Auth Verify Page — Handles magic link verification errors
 */

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { buildApiPath } from "@/lib/config";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<
    "loading" | "ip-verification" | "verifying" | "success" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    const messageParam = searchParams.get("message");

    if (errorParam) {
      setStatus("error");
      setError(messageParam || getErrorMessage(errorParam));
      return;
    }

    const userIdParam = searchParams.get("userId");
    const tokenParam = searchParams.get("token");

    if (userIdParam && tokenParam) {
      setUserId(userIdParam);
      setToken(tokenParam);
      setStatus("ip-verification");
      return;
    }

    setStatus("error");
    setError("Invalid link");
  }, [searchParams]);

  function getErrorMessage(errorType: string): string {
    switch (errorType) {
      case "used":
        return "This link has already been used. Please request a new sign-in link.";
      case "expired":
        return "This link has expired (30 minutes). Please request a new sign-in link.";
      case "invalid":
        return "Invalid link. Please make sure you copied the link correctly.";
      case "processing":
        return "Your sign-in request is being processed. Please wait a moment and try again.";
      default:
        return "An unexpected error occurred. Please try again.";
    }
  }

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) {
      document.getElementById(`code-${index + 1}`)?.focus();
    }
  };

  const handleCodeKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      document.getElementById(`code-${index - 1}`)?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
    }
  };

  const handleVerify = async () => {
    if (!userId || !token) return;
    const verificationCode = code.join("");
    if (verificationCode.length !== 6) return;

    setStatus("verifying");
    try {
      const res = await fetch(buildApiPath("auth/quicksign/verify-ip"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, token, code: verificationCode }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus("success");
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        setStatus("error");
        setError(data.message || "Verification failed");
      }
    } catch {
      setStatus("error");
      setError("Verification failed. Please try again.");
    }
  };

  // Loading
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Success
  if (status === "success") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          Verified Successfully
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You can close this window now.
        </p>
      </div>
    );
  }

  // IP Verification
  if (status === "ip-verification" || status === "verifying") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            IP Verification Required
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the 6-digit code sent to your email to verify this device.
          </p>

          <div
            className="mt-6 flex justify-center gap-2"
            onPaste={handleCodePaste}
          >
            {code.map((digit, i) => (
              <input
                key={i}
                id={`code-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(i, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(i, e)}
                className="h-12 w-10 rounded-lg border border-input bg-background text-center text-lg font-mono text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-colors"
                disabled={status === "verifying"}
              />
            ))}
          </div>

          <button
            onClick={handleVerify}
            disabled={
              status === "verifying" || code.join("").length !== 6
            }
            className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === "verifying" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </button>
        </div>
      </div>
    );
  }

  // Error
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error || "An unexpected error occurred."}
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            onClick={() => router.push("/login")}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Request New Link
          </button>
          <button
            onClick={() => router.push("/login")}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
