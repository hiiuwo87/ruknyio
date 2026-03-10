'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { isValidFormSlug } from '@/lib/utils/generateFormSlug';

// LocalStorage key for preview data
const FORM_PREVIEW_KEY = 'rukny_form_preview';

/**
 * Redirect page: reads slug from stored preview data and redirects to /app/forms/preview/[slug]
 * If no preview data exists, shows an error.
 */
function FormPreviewRedirect() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      const storedData = localStorage.getItem(FORM_PREVIEW_KEY);
      
      if (!storedData) {
        setError(true);
        return;
      }

      const parsed = JSON.parse(storedData);
      
      if (parsed.slug && isValidFormSlug(parsed.slug)) {
        // Redirect to slug-based preview URL
        router.replace(`/app/forms/preview/${parsed.slug}`);
        return;
      }

      // No slug in preview data
      setError(true);
    } catch {
      setError(true);
    }
  }, [router]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center px-4 max-w-md">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            خطأ في المعاينة
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            لا توجد بيانات للمعاينة. يرجى المعاينة من صفحة إنشاء النموذج.
          </p>
          <button
            onClick={() => router.push('/app/forms')}
            className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
          >
            العودة للنماذج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export default function FormPreviewPage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <FormPreviewRedirect />
    </Suspense>
  );
}
