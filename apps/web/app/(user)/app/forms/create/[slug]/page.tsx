'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, FileText, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { CreateFormWizard, type FormDraftRestore } from '@/components/(app)/forms';
import { isValidFormSlug } from '@/lib/utils/generateFormSlug';

// LocalStorage key for form draft persistence (must match CreateFormWizard)
const FORM_DRAFT_KEY = 'rukny_form_draft';

// Inner component that uses useSearchParams
function CreateFormContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;

  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [draftCleared, setDraftCleared] = useState(false);
  const [draftToRestore, setDraftToRestore] = useState<FormDraftRestore | null>(null);
  const [isValidSlug, setIsValidSlug] = useState(true);

  // Validate slug format
  useEffect(() => {
    if (!slug || !isValidFormSlug(slug)) {
      setIsValidSlug(false);
      return;
    }
  }, [slug]);

  useEffect(() => {
    if (!isValidSlug) return;

    const isNew = searchParams.get('new') === 'true';

    if (isNew) {
      localStorage.removeItem(FORM_DRAFT_KEY);
      setDraftCleared(true);
      setDraftToRestore(null);
      // Clean up the ?new=true param from URL, keep the slug
      window.history.replaceState({}, '', `/app/forms/create/${slug}`);
      return;
    }

    const savedDraft = localStorage.getItem(FORM_DRAFT_KEY);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        // Only offer to restore if the draft slug matches the URL slug
        if (draft.slug === slug && (draft.currentStep > 1 || draft.title)) {
          setShowDraftDialog(true);
        } else if (draft.slug !== slug) {
          // Slug mismatch - start fresh for this slug
          setDraftCleared(true);
        }
      } catch {
        localStorage.removeItem(FORM_DRAFT_KEY);
      }
    }
  }, [searchParams, slug, isValidSlug]);

  const handleContinueDraft = () => {
    const savedDraft = localStorage.getItem(FORM_DRAFT_KEY);
    if (savedDraft) {
      try {
        setDraftToRestore(JSON.parse(savedDraft) as FormDraftRestore);
      } catch {
        localStorage.removeItem(FORM_DRAFT_KEY);
      }
    }
    setShowDraftDialog(false);
  };

  const handleStartFresh = () => {
    localStorage.removeItem(FORM_DRAFT_KEY);
    setDraftCleared(true);
    setDraftToRestore(null);
    setShowDraftDialog(false);
  };

  // Invalid slug - show error
  if (!isValidSlug) {
    return (
      <div className="relative flex h-[calc(100%-1rem)] flex-1 min-w-0 bg-card m-2 md:ms-0 rounded-2xl border border-border/50 overflow-hidden items-center justify-center" dir="rtl">
        <div className="text-center px-4 max-w-md">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-100 dark:bg-red-900/30">
            <FileText className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">رابط غير صالح</h1>
          <p className="text-muted-foreground mb-6">
            رمز النموذج في الرابط غير صالح. يرجى إنشاء نموذج جديد.
          </p>
          <Link
            href="/app/forms"
            className="px-6 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors inline-block"
          >
            العودة للنماذج
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100%-1rem)] flex-1 min-w-0 bg-card m-2 md:ms-0 rounded-2xl border border-border/50 overflow-hidden" dir="rtl">
      {/* Draft Dialog */}
      {showDraftDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl shadow-xl p-6 mx-4 max-w-md w-full border border-border"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  لديك مسودة محفوظة
                </h3>
                <p className="text-sm text-muted-foreground">
                  هل تريد متابعة العمل عليها؟
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleContinueDraft}
                className="flex-1 px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                متابعة المسودة
              </button>
              <button
                onClick={handleStartFresh}
                className="flex-1 px-4 py-3 border border-border text-foreground rounded-xl font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                البدء من جديد
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Back Link - Fixed Position */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-4 right-4 z-20"
        >
          <Link 
            href="/app/forms" 
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-background/60 backdrop-blur-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all duration-200 text-sm"
          >
            <ArrowRight className="w-4 h-4" />
            <span className="font-medium">العودة للنماذج</span>
          </Link>
        </motion.div>

        <div className="p-3 sm:p-5 pt-14 sm:pt-5">
          {/* Create Form Wizard */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <CreateFormWizard
              key={draftCleared ? 'fresh' : draftToRestore ? 'restored' : 'default'}
              initialDraft={draftToRestore ?? undefined}
              initialSlug={slug}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function CreateFormLoading() {
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
export default function CreateFormWithSlugPage() {
  return (
    <Suspense fallback={<CreateFormLoading />}>
      <CreateFormContent />
    </Suspense>
  );
}
