'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import {
  FormsStats,
  FormsFiltersBar,
  FormCard,
  EmptyFormsState,
  FormsGridSkeleton,
  FormsStatsSkeleton,
} from '@/components/(app)/forms';
import {
  useForms,
  Form,
  FormsFilters,
  FormsStats as StatsType,
  FormsSortOption,
  filterForms,
  sortForms,
  calculateFormsStats,
} from '@/lib/hooks/useForms';
import { useRouter } from 'next/navigation';
import { toast, toastMessages } from '@/components/toast-provider';
import { generateFormSlug } from '@/lib/utils/generateFormSlug';

const VIEW_MODE_STORAGE_KEY = 'forms-view-mode';

function getStoredViewMode(): 'grid' | 'list' {
  if (typeof window === 'undefined') return 'grid';
  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === 'grid' || stored === 'list') return stored;
  } catch {
    // ignore
  }
  return 'grid';
}

export default function FormsPage() {
  const router = useRouter();
  const {
    getMyForms,
    deleteForm,
    duplicateForm,
    isLoading,
    error: hookError,
  } = useForms();

  const [forms, setForms] = useState<Form[]>([]);
  const [filters, setFilters] = useState<FormsFilters>({});
  const [sortBy, setSortBy] = useState<FormsSortOption>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => getStoredViewMode());
  const [isDeleting, setIsDeleting] = useState(false);

  const loadForms = useCallback(async () => {
    const data = await getMyForms();
    setForms(data);
  }, [getMyForms]);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  const stats: StatsType = useMemo(() => {
    return calculateFormsStats(forms);
  }, [forms]);

  const filteredForms = useMemo(() => {
    const filtered = filterForms(forms, filters);
    return sortForms(filtered, sortBy);
  }, [forms, filters, sortBy]);

  const handleCreateForm = useCallback(() => {
    const slug = generateFormSlug();
    router.push(`/app/forms/create/${slug}?new=true`);
  }, [router]);

  const handleEditForm = useCallback(
    (form: Form) => {
      router.push(`/app/forms/${form.id}/edit`);
    },
    [router]
  );

  const handleViewForm = useCallback(
    (form: Form) => {
      router.push(`/app/forms/${form.id}`);
    },
    [router]
  );

  const handleViewResponses = useCallback(
    (form: Form) => {
      router.push(`/app/forms/${form.id}/responses`);
    },
    [router]
  );

  const handleDuplicateForm = useCallback(
    async (form: Form) => {
      const duplicated = await duplicateForm(form.id);
      if (duplicated) {
        setForms((prev) => [duplicated, ...prev]);
        toast.success('تم نسخ النموذج بنجاح');
      } else {
        toast.error('فشل نسخ النموذج. يرجى المحاولة مرة أخرى');
      }
    },
    [duplicateForm]
  );

  const handleDeleteForm = useCallback(async (form: Form) => {
    setIsDeleting(true);
    const success = await deleteForm(form.id);
    setIsDeleting(false);

    if (success) {
      setForms((prev) => prev.filter((f) => f.id !== form.id));
      toastMessages.deleteSuccess('النموذج');
    } else {
      toast.error('فشل حذف النموذج. يرجى المحاولة مرة أخرى');
    }
  }, [deleteForm]);

  const handleViewModeChange = useCallback((mode: 'grid' | 'list') => {
    setViewMode(mode);
  }, []);

  return (
    <div
      className="relative flex h-[calc(100%-1rem)] flex-1 min-w-0 gap-4 m-2 md:ms-0"
      dir="rtl"
    >
      {/* Main Content */}
      <div className="flex-1 min-w-0 bg-card  overflow-hidden">
        <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="p-4 sm:p-6 space-y-5">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">نماذجي</h1>
                  <p className="text-sm text-muted-foreground">
                    إنشاء وإدارة النماذج والاستبيانات
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadForms}
                  disabled={isLoading}
                  aria-label="تحديث قائمة النماذج"
                  aria-busy={isLoading}
                  className={`p-2 sm:p-2.5 rounded-xl bg-card text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none ${isLoading ? 'animate-spin' : ''}`}
                >
                  <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <button
                  type="button"
                  onClick={handleCreateForm}
                  aria-label="إنشاء نموذج جديد"
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء نموذج</span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Error block with retry */}
          {hookError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{hookError}</span>
              </div>
              <button
                type="button"
                onClick={loadForms}
                disabled={isLoading}
                className="shrink-0 rounded-lg px-3 py-1.5 font-medium bg-destructive/20 hover:bg-destructive/30 transition-colors disabled:opacity-50"
              >
                إعادة المحاولة
              </button>
            </motion.div>
          )}

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {isLoading ? (
              <FormsStatsSkeleton />
            ) : (
              <FormsStats stats={stats} isLoading={isLoading} />
            )}
          </motion.div>

          {/* Filters */}
          {forms.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <FormsFiltersBar
                filters={filters}
                onFiltersChange={setFilters}
                sortBy={sortBy}
                onSortChange={setSortBy}
                resultsCount={filteredForms.length}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
              />
            </motion.div>
          )}

          {/* Content */}
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <FormsGridSkeleton count={6} />
              </motion.div>
            ) : forms.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <EmptyFormsState onCreateForm={handleCreateForm} />
              </motion.div>
            ) : filteredForms.length === 0 ? (
              <motion.div
                key="no-results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="rounded-3xl bg-muted/30 p-8 text-center"
              >
                <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-foreground mb-1">
                  لا توجد نتائج
                </h3>
                <p className="text-sm text-muted-foreground">
                  جرب تغيير معايير البحث
                </p>
              </motion.div>
            ) : (
              <motion.div
                layout
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4'
                    : 'flex flex-col gap-3'
                }
              >
                {filteredForms.map((form, index) => (
                  <motion.div
                    key={form.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <FormCard
                      form={form}
                      onEdit={handleEditForm}
                      onDelete={handleDeleteForm}
                      onView={handleViewForm}
                      onDuplicate={handleDuplicateForm}
                      onViewResponses={handleViewResponses}
                      variant={viewMode}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Blur Gradient Effect */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card via-card/80 to-transparent pointer-events-none z-10" />
          </div>
        </div>
      </div>
    </div>
  );
}
