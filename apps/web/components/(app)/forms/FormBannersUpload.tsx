'use client';

import React, { useRef, memo, useCallback } from 'react';
import { toast } from '@/components/toast-provider';
import { ImagePlus, Trash2, Check, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_FILES = 5;
const MAX_MB = 5;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export type BannerDisplayMode = 'single' | 'slider';

export interface FormBannersUploadProps {
  /** Array of banner files or URLs */
  banners: (File | string)[];
  /** Callback when banners change */
  onChange: (banners: (File | string)[]) => void;
  /** Display mode: single image or slider */
  displayMode: BannerDisplayMode;
  /** Callback when display mode changes */
  onDisplayModeChange: (mode: BannerDisplayMode) => void;
  /** Maximum number of banners */
  maxFiles?: number;
  /** Maximum file size in MB */
  maxSizeMB?: number;
}

function FormBannersUpload({
  banners = [],
  onChange,
  displayMode = 'single',
  onDisplayModeChange,
  maxFiles = MAX_FILES,
  maxSizeMB = MAX_MB,
}: FormBannersUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const getPreviewUrl = useCallback((banner: File | string): string => {
    if (typeof banner === 'string') return banner;
    return URL.createObjectURL(banner);
  }, []);

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list) return;
    handleAdd(Array.from(list));
    e.currentTarget.value = '';
  };

  const handleAdd = (newFiles: File[]) => {
    const availableSlots = maxFiles - banners.length;
    if (availableSlots <= 0) {
      toast.error(`الحد الأقصى للصور هو ${maxFiles}`);
      return;
    }
    const validFiles: File[] = [];
    for (const f of newFiles) {
      if (validFiles.length >= availableSlots) {
        toast.error(`يمكنك إضافة ${availableSlots} صور فقط`);
        break;
      }
      if (!ALLOWED.includes(f.type)) {
        toast.error('نوع ملف غير مدعوم (JPEG, PNG, WebP فقط)');
        continue;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        toast.error(`حجم الملف يجب أن لا يتجاوز ${maxSizeMB} ميجابايت`);
        continue;
      }
      validFiles.push(f);
    }
    if (validFiles.length > 0) {
      onChange([...banners, ...validFiles]);
    }
  };

  const removeAt = (index: number) => {
    onChange(banners.filter((_, i) => i !== index));
  };

  const setAsPrimary = (index: number) => {
    if (index === 0) return;
    const newBanners = [...banners];
    const [item] = newBanners.splice(index, 1);
    newBanners.unshift(item);
    onChange(newBanners);
    toast.success('تم تعيين الصورة كصورة رئيسية');
  };

  const hasImages = banners.length > 0;

  return (
    <div className="space-y-3">
      {/* Display Mode Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-full bg-muted p-0.5">
          <button
            type="button"
            onClick={() => onDisplayModeChange('single')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
              displayMode === 'single'
                ? "bg-foreground text-background"
                : "text-muted-foreground"
            )}
          >
            <ImagePlus className="w-3.5 h-3.5" />
            صورة واحدة
          </button>
          <button
            type="button"
            onClick={() => onDisplayModeChange('slider')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium",
              displayMode === 'slider'
                ? "bg-foreground text-background"
                : "text-muted-foreground"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            سلايدر
          </button>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {banners.length}/{maxFiles}
        </span>
      </div>

      {/* Upload Area */}
      <input
        ref={inputRef}
        id="form-banner-upload-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={displayMode === 'slider'}
        onChange={onSelect}
        className="hidden"
      />

      {!hasImages ? (
        <label
          htmlFor="form-banner-upload-input"
          className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-border/60 rounded-xl cursor-pointer hover:border-muted-foreground/30 bg-muted/20"
        >
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
            <ImagePlus className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-foreground font-medium">اضغط لإضافة صور الغلاف</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {displayMode === 'single' ? 'صورة واحدة كغلاف' : `حتى ${maxFiles} صور`} • {maxSizeMB}MB لكل صورة
          </p>
        </label>
      ) : (
        <div className="space-y-2">
          {/* Images Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {banners.map((banner, i) => {
              const previewUrl = getPreviewUrl(banner);
              const isPrimary = i === 0;

              return (
                <div
                  key={`banner-${i}`}
                  className={cn(
                    "group relative rounded-xl overflow-hidden border",
                    isPrimary ? "border-foreground/30" : "border-border/60"
                  )}
                >
                  <div className="relative w-full h-24">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt={`بانر ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Primary Badge */}
                  {isPrimary && (
                    <span className="absolute top-1.5 right-1.5 bg-foreground text-background text-[9px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" />
                      رئيسي
                    </span>
                  )}

                  {/* Action Buttons */}
                  <div className="absolute top-1.5 left-1.5 flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100">
                    {!isPrimary && (
                      <button
                        type="button"
                        onClick={() => setAsPrimary(i)}
                        className="bg-background/80 backdrop-blur-sm rounded-full p-1 active:scale-95 touch-manipulation"
                        title="تعيين كصورة رئيسية"
                      >
                        <Check className="w-3 h-3 text-foreground" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      className="bg-background/80 backdrop-blur-sm rounded-full p-1 active:scale-95 touch-manipulation"
                      title="حذف"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add More Button */}
            {banners.length < maxFiles && (
              <label
                htmlFor="form-banner-upload-input"
                className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-border/60 rounded-xl cursor-pointer hover:border-muted-foreground/30"
              >
                <ImagePlus className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground mt-1">إضافة</span>
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const MemoizedFormBannersUpload = memo(FormBannersUpload);
export default MemoizedFormBannersUpload;
