'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { generateFormSlug, isValidFormSlug } from '@/lib/utils/generateFormSlug';

// LocalStorage key for form draft persistence (must match CreateFormWizard)
const FORM_DRAFT_KEY = 'rukny_form_draft';

/**
 * Redirect page: generates a slug and redirects to /app/forms/create/[slug]
 * - If ?new=true: generates fresh slug, redirects to /app/forms/create/[newSlug]?new=true
 * - If no param: checks for existing draft slug, or generates new slug
 */
function CreateFormRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const isNew = searchParams.get('new') === 'true';

    if (isNew) {
      // New form: generate fresh slug and redirect
      const newSlug = generateFormSlug();
      router.replace(`/app/forms/create/${newSlug}?new=true`);
      return;
    }

    // Check for existing draft with a slug
    const savedDraft = localStorage.getItem(FORM_DRAFT_KEY);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.slug && isValidFormSlug(draft.slug)) {
          // Redirect to the draft's slug URL
          router.replace(`/app/forms/create/${draft.slug}`);
          return;
        }
      } catch {
        localStorage.removeItem(FORM_DRAFT_KEY);
      }
    }

    // No draft or invalid draft: generate new slug
    const newSlug = generateFormSlug();
    router.replace(`/app/forms/create/${newSlug}?new=true`);
  }, [router, searchParams]);

  return (
    <div className="relative flex h-[calc(100%-1rem)] flex-1 min-w-0 bg-card m-2 md:ms-0 rounded-2xl border border-border/50 overflow-hidden" dir="rtl">
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    </div>
  );
}

// Main page component wraps content in Suspense
export default function CreateFormPage() {
  return (
    <Suspense fallback={
      <div className="relative flex h-[calc(100%-1rem)] flex-1 min-w-0 bg-card m-2 md:ms-0 rounded-2xl border border-border/50 overflow-hidden" dir="rtl">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">جاري التحميل...</p>
          </div>
        </div>
      </div>
    }>
      <CreateFormRedirect />
    </Suspense>
  );
}
