'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { FormFullPreview, type FormPreviewData } from '@/components/(app)/forms/FormFullPreview';
import { DEFAULT_THEME } from '@/components/(app)/forms/FormThemeCustomizer';
import { isValidFormSlug } from '@/lib/utils/generateFormSlug';
import { Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { getAuthUrl } from '@/lib/url';

// LocalStorage key for preview data
const FORM_PREVIEW_KEY = 'rukny_form_preview';

function FormPreviewContent() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [previewData, setPreviewData] = useState<FormPreviewData | null>(null);
  const [formSlug, setFormSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'auth' | 'data' | 'slug' | null>(null);

  // Validate slug format
  useEffect(() => {
    if (!slug || !isValidFormSlug(slug)) {
      setError('رمز النموذج في الرابط غير صالح');
      setErrorType('slug');
      setLoading(false);
      return;
    }
  }, [slug]);

  // Load preview data after auth is resolved
  useEffect(() => {
    if (authLoading) return;
    if (errorType === 'slug') return; // Already errored on slug validation

    // Auth check - user must be logged in
    if (!isAuthenticated || !user) {
      setError('يجب تسجيل الدخول لمعاينة النماذج');
      setErrorType('auth');
      setLoading(false);
      return;
    }

    try {
      const storedData = localStorage.getItem(FORM_PREVIEW_KEY);
      
      if (!storedData) {
        setError('لا توجد بيانات للمعاينة');
        setErrorType('data');
        setLoading(false);
        return;
      }

      const parsed = JSON.parse(storedData) as FormPreviewData & { slug?: string; userId?: string };
      
      // Security: verify the preview belongs to the current user
      if (parsed.userId && parsed.userId !== user.id) {
        setError('ليس لديك صلاحية لمعاينة هذا النموذج');
        setErrorType('auth');
        setLoading(false);
        localStorage.removeItem(FORM_PREVIEW_KEY);
        return;
      }

      // Security: verify the slug in URL matches the stored preview data
      if (parsed.slug && parsed.slug !== slug) {
        setError('رمز النموذج لا يتطابق مع بيانات المعاينة');
        setErrorType('data');
        setLoading(false);
        return;
      }

      // Set form slug for URL display
      setFormSlug(slug);

      // Ensure theme has default values
      const data: FormPreviewData = {
        ...parsed,
        title: parsed.title || 'نموذج بدون عنوان',
        theme: parsed.theme || DEFAULT_THEME,
        fields: parsed.fields || [],
        steps: parsed.steps || [],
        isMultiStep: parsed.isMultiStep || false,
        allowMultipleSubmissions: parsed.allowMultipleSubmissions || false,
        requiresAuthentication: parsed.requiresAuthentication || false,
        showProgressBar: parsed.showProgressBar ?? true,
        showQuestionNumbers: parsed.showQuestionNumbers ?? true,
      };

      setPreviewData(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load preview data:', err);
      setError('فشل في تحميل بيانات المعاينة');
      setErrorType('data');
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, user, slug, errorType]);

  // Handle close - go back or close window
  const handleClose = () => {
    localStorage.removeItem(FORM_PREVIEW_KEY);
    
    if (window.opener) {
      window.close();
    } else {
      router.back();
    }
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {authLoading ? 'جاري التحقق من الصلاحيات...' : 'جاري تحميل المعاينة...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !previewData) {
    const isAuthError = errorType === 'auth';
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center px-4 max-w-md">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
            isAuthError 
              ? 'bg-red-100 dark:bg-red-900/30' 
              : 'bg-amber-100 dark:bg-amber-900/30'
          }`}>
            {isAuthError 
              ? <ShieldAlert className="w-8 h-8 text-red-500" />
              : <AlertTriangle className="w-8 h-8 text-amber-500" />
            }
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {isAuthError ? 'غير مصرّح' : errorType === 'slug' ? 'رابط غير صالح' : 'خطأ في المعاينة'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {error || 'لا توجد بيانات'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isAuthError ? (
              <button
                onClick={() => window.location.replace(getAuthUrl('/login'))}
                className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                تسجيل الدخول
              </button>
            ) : (
              <button
                onClick={handleClose}
                className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                العودة لإنشاء النموذج
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Build form public URL
  const formUrl = formSlug ? `${window.location.origin}/f/${formSlug}` : null;

  return <FormFullPreview data={previewData} onClose={handleClose} formUrl={formUrl} />;
}

export default function FormPreviewWithSlugPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <FormPreviewContent />
    </Suspense>
  );
}
