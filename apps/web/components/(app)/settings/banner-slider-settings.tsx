'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImagePlus,
  Trash2,
  Loader2,
  GripVertical,
  Upload,
  X,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import {
  getBanners,
  uploadBanners,
  deleteBanners,
  type BannerItem,
} from '@/actions/settings';
import { SettingsSection } from './settings-section';

const MAX_BANNERS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function BannerSliderSettings() {
  const toast = useToast();
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingKeys, setDeletingKeys] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing banners
  const fetchBanners = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await getBanners();
      if (error) {
        toast.error('فشل في تحميل البانرات');
      } else if (data) {
        setBanners(data);
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل البانرات');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  // Validate files
  const validateFiles = (files: File[]): File[] => {
    const remaining = MAX_BANNERS - banners.length;
    if (remaining <= 0) {
      toast.error(`الحد الأقصى ${MAX_BANNERS} بانرات`);
      return [];
    }

    const validFiles: File[] = [];
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: نوع الملف غير مدعوم`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: الحجم يتجاوز 5 ميغابايت`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > remaining) {
      toast.error(`يمكنك رفع ${remaining} بانر فقط`);
      return validFiles.slice(0, remaining);
    }

    return validFiles;
  };

  // Upload handler
  const handleUpload = async (files: File[]) => {
    const validFiles = validateFiles(files);
    if (validFiles.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      validFiles.forEach((file) => formData.append('files', file));

      const { data, error } = await uploadBanners(formData);
      if (error) {
        toast.error(error || 'فشل في رفع البانرات');
      } else {
        toast.success('تم رفع البانرات بنجاح');
        // Refresh banners from server
        await fetchBanners();
      }
    } catch {
      toast.error('حدث خطأ أثناء رفع البانرات');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // File input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleUpload(files);
  };

  // Delete banner
  const handleDelete = async (key: string) => {
    setDeletingKeys((prev) => new Set(prev).add(key));
    try {
      const { error } = await deleteBanners([key]);
      if (error) {
        toast.error('فشل في حذف البانر');
      } else {
        setBanners((prev) => prev.filter((b) => b.key !== key));
        toast.success('تم حذف البانر');
      }
    } catch {
      toast.error('حدث خطأ أثناء حذف البانر');
    } finally {
      setDeletingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleUpload(files);
  };

  const canUploadMore = banners.length < MAX_BANNERS;

  return (
    <SettingsSection
      title="سلايدر البانر الإعلاني"
      description="أضف صور بانر لعرضها في واجهة متجرك (الحد الأقصى 5 صور)"
    >
      {/* Upload Area */}
      {canUploadMore && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            'relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-all cursor-pointer',
            isDragOver
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-border/50 bg-muted/20 hover:border-border hover:bg-muted/40',
            isUploading && 'pointer-events-none opacity-60'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            multiple
            onChange={handleFileChange}
            className="hidden"
          />

          {isUploading ? (
            <>
              <Loader2 className="size-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">جاري رفع الصور...</p>
            </>
          ) : (
            <>
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <Upload className="size-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  اسحب الصور هنا أو انقر للرفع
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PNG, JPG, WebP, GIF — حتى 5 ميغابايت لكل صورة
                </p>
              </div>
              <p className="text-xs text-muted-foreground/70">
                {banners.length} / {MAX_BANNERS} بانرات
              </p>
            </>
          )}
        </div>
      )}

      {/* Banner Preview Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      ) : banners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <ImagePlus className="size-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            لا توجد بانرات بعد — أضف صورة أعلاه
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {banners.map((banner, index) => {
              const isDeleting = deletingKeys.has(banner.key);
              return (
                <motion.div
                  key={banner.key}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    'group relative overflow-hidden rounded-xl border border-border/40 bg-muted/20',
                    isDeleting && 'opacity-50'
                  )}
                >
                  {/* Banner Image */}
                  <div className="relative aspect-[3.5/1] w-full overflow-hidden">
                    <img
                      src={banner.url}
                      alt={`بانر ${index + 1}`}
                      className="size-full object-cover"
                    />

                    {/* Overlay Controls */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleDelete(banner.key)}
                        disabled={isDeleting}
                        className="flex size-9 items-center justify-center rounded-lg bg-red-500/90 text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Banner Info */}
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="size-3.5 text-muted-foreground/40" />
                      <span className="text-xs text-muted-foreground">
                        بانر {index + 1}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Max reached message */}
      {!canUploadMore && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2">
          <AlertCircle className="size-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            وصلت للحد الأقصى ({MAX_BANNERS} بانرات). احذف بانر لإضافة واحد جديد.
          </p>
        </div>
      )}
    </SettingsSection>
  );
}
