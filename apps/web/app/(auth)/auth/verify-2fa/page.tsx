'use client';

/**
 * 🔐 Verify 2FA Page - Two-factor authentication verification
 * 
 * يُستخدم عند تسجيل الدخول عندما يكون المستخدم لديه 2FA مفعل
 * يتطلب pendingSessionId من الـ URL parameters
 */

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Shield, 
  Loader2, 
  ArrowRight,
  Key,
  Smartphone
} from 'lucide-react';
import { setCsrfToken, resetRefreshState, scheduleSilentRefresh } from '@/lib/api/client';
import { Checkbox } from '@/components/ui/checkbox';

// OTP Input Component
function OTPInput({ 
  value, 
  onChange, 
  disabled,
  autoFocus = true
}: { 
  value: string; 
  onChange: (val: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focused, setFocused] = useState(0);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus]);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d*$/.test(digit)) return;
    
    const newValue = value.split('');
    newValue[index] = digit.slice(-1);
    const result = newValue.join('').slice(0, 6);
    onChange(result);
    
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
      setFocused(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setFocused(index - 1);
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
      setFocused(index - 1);
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
      setFocused(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pastedData);
    const lastIndex = Math.min(pastedData.length, 5);
    inputRefs.current[lastIndex]?.focus();
    setFocused(lastIndex);
  };

  return (
    <div className="flex gap-2.5 justify-center" dir="ltr">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={() => setFocused(index)}
          disabled={disabled}
          className={`w-12 h-14 text-center text-xl font-bold rounded-4xl border transition-all duration-200 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none
            ${focused === index 
              ? "border-blue-500 ring-2 ring-blue-500/20" 
              : value[index] 
                ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20" 
                : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        />
      ))}
    </div>
  );
}

function Verify2FAContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);

  // Redirect if no session ID
  useEffect(() => {
    if (!sessionId) {
      router.push('/login?session=expired');
    }
  }, [sessionId, router]);

  // 🔒 التحقق من صلاحية الجلسة عند تحميل الصفحة (مع retry)
  useEffect(() => {
    if (!sessionId) return;

    const checkSession = async (retryCount = 0) => {
      try {
        const response = await fetch(`/api/auth/2fa/check-session/${sessionId}`, {
          method: 'GET',
          credentials: 'include',
        });

        const data = await response.json();

        if (!response.ok || !data.valid) {
          // إذا كانت المحاولة الأولى وفشلت، جرب مرة أخرى (قد تكون الجلسة لم تُنشأ بعد)
          if (retryCount < 2) {
            console.log(`[2FA] Session check failed, retrying... (${retryCount + 1}/2)`);
            setTimeout(() => checkSession(retryCount + 1), 500);
            return;
          }
          
          // الجلسة منتهية - إعادة التوجيه إلى تسجيل الدخول
          console.error('[2FA] Session invalid or expired:', data.error);
          router.push('/login?session=expired');
          return;
        }

        console.log('[2FA] Session valid, proceeding...');
        setSessionValid(true);
      } catch (err) {
        console.error('[2FA] Failed to check session:', err);
        // إذا كانت المحاولة الأولى وفشلت، جرب مرة أخرى
        if (retryCount < 2) {
          setTimeout(() => checkSession(retryCount + 1), 500);
          return;
        }
        router.push('/login?session=expired');
      } finally {
        if (retryCount >= 2) {
          setIsCheckingSession(false);
        }
      }
    };

    checkSession();
  }, [sessionId, router]);

  const handleSubmit = async () => {
    if (code.length !== 6 && !useBackupCode) {
      setError('يرجى إدخال رمز مكون من 6 أرقام');
      return;
    }

    if (useBackupCode && code.length < 8) {
      setError('يرجى إدخال الرمز الاحتياطي بالكامل');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 🔒 Use Route Handler for proper cookie forwarding
      const response = await fetch('/api/auth/2fa/verify-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          token: code.replace(/-/g, ''),
          pendingSessionId: sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // إذا انتهت الجلسة، إعادة التوجيه إلى تسجيل الدخول
        if (data.expired) {
          router.push('/login?session=expired');
          return;
        }
        throw new Error(data.error || data.message || 'رمز التحقق غير صحيح');
      }

      // 🔒 Store CSRF token (access token is in httpOnly cookie)
      if (data.csrf_token) {
        setCsrfToken(data.csrf_token);
        resetRefreshState(); // Reset any failed refresh state
      }
      if (typeof data.expires_in === 'number') {
        scheduleSilentRefresh(data.expires_in);
      }

      // Show message if backup code was used
      if (data.usedBackupCode) {
        // You might want to show a toast here
        console.log('تم استخدام رمز احتياطي');
      }

      // Redirect to dashboard
      router.push('/app');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء التحقق');
      setCode(''); // Clear code on error to prevent infinite loop
    } finally {
      setIsLoading(false);
    }
  };

  // Auto submit when code is complete (only once)
  useEffect(() => {
    if (code.length === 6 && !isLoading && !useBackupCode && !error) {
      handleSubmit();
    }
  }, [code]);

  if (!sessionId || isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">جارٍ التحقق من الجلسة...</p>
        </div>
      </div>
    );
  }

  if (!sessionValid) {
    return null; // سيتم إعادة التوجيه
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
      dir="rtl"
      className="w-full max-w-sm mx-auto px-6 py-8"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}
    >
      {/* Header */}
      <div className="text-center my-22 mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          المصادقة الثنائية
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {useBackupCode 
            ? 'أدخل أحد الرموز الاحتياطية'
            : 'أدخل الرمز من تطبيق المصادقة'
          }
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 rounded-4xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-600 dark:text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {/* OTP Input or Backup Code Input */}
      {useBackupCode ? (
        <div className="mb-5">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            الرمز الاحتياطي
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            disabled={isLoading}
            className="w-full h-14 px-4 text-center text-lg font-mono border border-zinc-300 dark:border-zinc-600 rounded-4xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-50"
            dir="ltr"
          />
        </div>
      ) : (
        <div className="mb-5">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            رمز التحقق
          </label>
          <OTPInput
            value={code}
            onChange={setCode}
            disabled={isLoading}
          />
        </div>
      )}

      {/* تذكر هذا الجهاز */}
      {!useBackupCode && (
        <label className="flex items-center gap-3 mb-5 cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">
          <Checkbox
            checked={rememberDevice}
            onCheckedChange={(checked) => setRememberDevice(checked === true)}
          />
          <span>تذكر هذا الجهاز (تخطي 2FA في المرات القادمة)</span>
        </label>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || (useBackupCode ? code.length < 8 : code.length !== 6)}
        className="flex items-center justify-center gap-2 h-14 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-base rounded-4xl font-medium transition-all"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>جاري التحقق...</span>
          </>
        ) : (
          <>
            <Shield className="w-5 h-5" />
            <span>تحقق</span>
          </>
        )}
      </button>

      {/* Back Link */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors inline-flex items-center gap-1"
        >
          <ArrowRight className="w-4 h-4" />
          العودة لتسجيل الدخول
        </button>
      </div>

      {/* Toggle to Backup Code */}
      <div className="flex items-center gap-4 my-8">
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
        <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium whitespace-nowrap">
          أو
        </span>
        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
      </div>

      <button
        type="button"
        onClick={() => { setUseBackupCode(!useBackupCode); setCode(''); setError(null); }}
        className="flex items-center justify-center gap-2 h-12 w-full rounded-4xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-sm font-medium transition-all"
      >
        {useBackupCode ? (
          <>
            <Smartphone className="w-4 h-4" />
            استخدام رمز التطبيق
          </>
        ) : (
          <>
            <Key className="w-4 h-4" />
            استخدام رمز احتياطي
          </>
        )}
      </button>

      {/* Help Text */}
      <p className="text-center text-xs text-zinc-400 dark:text-zinc-500 mt-8 leading-relaxed">
        فقدت الوصول للتطبيق؟{' '}
        <a href="/support" className="text-blue-600 dark:text-blue-400 hover:underline">
          تواصل مع الدعم
        </a>
      </p>
    </form>
  );
}

export default function Verify2FAPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <Verify2FAContent />
    </Suspense>
  );
}
