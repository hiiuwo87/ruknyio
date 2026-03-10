'use client';

import React from 'react';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';

interface AuthFormProps {
  type: 'login' | 'register';
  email: string;
  onEmailChange: (email: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
  error?: string | null;
  onGoogleLogin?: () => void;
  onLinkedInLogin?: () => void;
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true" focusable="false" {...props}>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.655 32.656 29.255 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917Z" />
      <path fill="#FF3D00" d="M6.306 14.691 12.88 19.51C14.655 15.108 18.962 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691Z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.197l-6.191-5.238C29.184 35.091 26.715 36 24 36c-5.234 0-9.62-3.318-11.282-7.946l-6.525 5.026C9.505 39.556 16.227 44 24 44Z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.08 12.08 0 0 1-4.085 5.565l.003-.002 6.191 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.651-.389-3.917Z" />
    </svg>
  );
}

function LinkedInIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" {...props}>
      <path fill="#0077B5" d="M20.447 20.452h-3.554v-5.569c0-1.327-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.476-.9 1.637-1.85 3.369-1.85 3.602 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124Zm1.777 13.019H3.559V9h3.555v11.452Z" />
    </svg>
  );
}

export default function AuthForm({
  type,
  email,
  onEmailChange,
  onSubmit,
  isLoading = false,
  error ,
  onGoogleLogin,
  onLinkedInLogin,
}: AuthFormProps) {
  const isLogin = type === 'login';

  return (
    <form
      onSubmit={onSubmit}
      dir="rtl"
      className="w-full max-w-sm mx-auto px-6 py-8"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {isLogin ? 'تسجيل الدخول إلى ركني' : 'إنشاء حساب جديد'}
        </h1>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 rounded-4xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-600 dark:text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {/* Email Field */}
      <div className="mb-5">
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          البريد الإلكتروني
        </label>
        <div className="relative">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <Mail className="w-5 h-5 text-zinc-400" />
          </span>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="w-full h-14 pr-12 pl-4 text-base border border-zinc-300 dark:border-zinc-600 rounded-4xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            placeholder="example@email.com"
            required
            disabled={isLoading}
            dir="ltr"
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className="flex items-center  justify-center gap-2 h-14 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-base rounded-4xl font-medium transition-all"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>جاري الإرسال...</span>
          </>
        ) : (
          <>
            <span>المتابعة بالبريد الإلكتروني</span>
            <ArrowLeft className="w-5 h-5" />
          </>
        )}
      </button>


      {/* Divider */}
      <div className="flex items-center gap-4 my-8">
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
        <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium whitespace-nowrap">
          أو المتابعة عبر
        </span>
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
      </div>

      {/* Social Login Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onGoogleLogin}
          className="flex items-center justify-center gap-2 h-14 rounded-4xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 active:bg-zinc-100 dark:active:bg-zinc-600 transition-all"
          aria-label="تسجيل الدخول بحساب Google"
        >
          <GoogleIcon />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Google</span>
        </button>

        <button
          type="button"
          onClick={onLinkedInLogin}
          className="flex items-center justify-center gap-2 h-14 rounded-4xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 active:bg-zinc-100 dark:active:bg-zinc-600 transition-all"
          aria-label="تسجيل الدخول بحساب LinkedIn"
        >
          <LinkedInIcon />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">LinkedIn</span>
        </button>
      </div>

      {/* Terms */}
      <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 mt-8 leading-relaxed">
        بالمتابعة، أنت توافق على{' '}
        <a href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">
          شروط الخدمة
        </a>{' '}
        و{' '}
        <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
          سياسة الخصوصية
        </a>
      </p>
    </form>
  );
}
