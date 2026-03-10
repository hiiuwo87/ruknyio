'use client';

/**
 * صفحة تأكيد البريد - Check Email
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Mail, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { buildApiPath } from '@/lib/config';
import { motion } from 'framer-motion';

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email') || '';
  const type = searchParams.get('type') as 'LOGIN' | 'SIGNUP' || 'LOGIN';

  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  // Redirect if no email
  useEffect(() => {
    if (!email) {
      router.replace('/login');
    }
  }, [email, router]);

  const handleResend = async () => {
    if (!canResend || resending) return;

    setResending(true);
    setResendSuccess(false);
    setResendError('');

    try {
      const res = await fetch(buildApiPath('auth/quicksign/resend'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setResendSuccess(true);
        setCanResend(false);
        setCountdown(60);
      } else {
        setResendError(data.message || 'فشل إعادة الإرسال. يرجى المحاولة لاحقاً');
      }
    } catch (error) {
      setResendError('فشل إعادة الإرسال. يرجى المحاولة لاحقاً');
    } finally {
      setResending(false);
    }
  };

  const handleChangeEmail = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('quicksign_email');
    }
    router.replace('/login');
  };

  // Loading state
  if (!email) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-6" dir="rtl">
        <Loader2 className="animate-spin h-8 w-8 text-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#ffffff] p-6" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center w-full max-w-sm"
      >

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-light tracking-tight text-foreground mb-3">
            تحقق من بريدك
          </h1>
          <p className="text-sm text-muted-foreground mb-4">
            أرسلنا رابطاً تسجيل الدخول إلى
          </p>
          <p className="text-base font-medium text-foreground" dir="ltr">
            {email}
          </p>
        </div>

        {/* Info */}
        <div className="w-full space-y-4 mb-6">
          <div className="text-center p-4 bg-muted/30 rounded-2xl">
            <p className="text-sm text-muted-foreground">
              {type === 'LOGIN'
                ? 'اضغط على الرابط في بريدك لتسجيل الدخول'
                : 'اضغط على الرابط في بريدك لإكمال التسجيل'}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-2">
              الرابط صالح لمدة 10 دقائق فقط
            </p>
          </div>

          {/* Success Message */}
          {resendSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl animate-in fade-in-0 duration-300">
              <p className="text-sm text-emerald-600 dark:text-emerald-400 text-center">
                ✓ تم إعادة إرسال الرابط بنجاح
              </p>
            </div>
          )}

          {/* Error Message */}
          {resendError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl animate-in fade-in-0 duration-300">
              <p className="text-sm text-red-500 text-center">
                {resendError}
              </p>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="w-full space-y-3">
          {/* Resend Button */}
          <button
            onClick={handleResend}
            disabled={!canResend || resending}
            className="flex items-center justify-center gap-2 w-full h-12 border border-border/80 bg-background hover:bg-muted/50 hover:border-foreground/20 text-foreground font-medium rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري الإرسال...</span>
              </>
            ) : !canResend ? (
              <span>إعادة الإرسال ({countdown})</span>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>إعادة إرسال الرابط</span>
              </>
            )}
          </button>

          {/* Change Email Button */}
          <button
            onClick={handleChangeEmail}
            className="flex items-center justify-center gap-2 w-full h-12 text-muted-foreground hover:text-foreground font-medium rounded-full transition-all duration-300"
          >
            <ArrowRight className="h-4 w-4" />
            <span>تغيير البريد الإلكتروني</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-6" dir="rtl">
          <Loader2 className="animate-spin h-8 w-8 text-foreground" />
        </div>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
