'use client';

import React, { useState, useRef, memo, useCallback } from 'react';
import { toast } from '@/components/toast-provider';
import { Upload, ImagePlus, Trash2, X, Check, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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

  // Get preview URL for a banner (File or URL string)
  const getPreviewUrl = useCallback((banner: File | string): string => {
    if (typeof banner === 'string') {
      return banner;
    }
    return URL.createObjectURL(banner);
  }, []);

  // Handle file selection
  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list) return;
    handleAdd(Array.from(list));
    e.currentTarget.value = '';
  };

  // Add new files
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

  // Remove banner at index
  const removeAt = (index: number) => {
    const newBanners = banners.filter((_, i) => i !== index);
    onChange(newBanners);
  };

  // Set as primary (move to first position)
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
    <div className="space-y-4">
      {/* Display Mode Toggle */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">نمط العرض:</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onDisplayModeChange('single')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              displayMode === 'single'
                ? "bg-indigo-500 text-white"
                : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-indigo-300"
            )}
          >
            <ImagePlus className="w-4 h-4" />
            صورة واحدة
          </button>
          <button
            type="button"
            onClick={() => onDisplayModeChange('slider')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              displayMode === 'slider'
                ? "bg-indigo-500 text-white"
                : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-indigo-300"
            )}
          >
            <Layers className="w-4 h-4" />
            سلايدر متعدد
          </button>
        </div>
      </div>

      {/* Info Text */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {displayMode === 'single' 
          ? 'سيتم عرض الصورة الأولى كغلاف للنموذج'
          : 'سيتم عرض جميع الصور كسلايدر متحرك في أعلى النموذج'
        }
      </p>

      {/* Upload Area */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Upload Button */}
          <label 
            htmlFor="form-banner-upload-input"
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-300 transition-colors cursor-pointer active:scale-[0.98] touch-manipulation"
          >
            <ImagePlus className="w-4 h-4" />
            <span>اختر صور</span>
          </label>
          
          {/* Count Info */}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {banners.length} / {maxFiles} صور
          </span>
          
          {/* Hidden file input */}
          <input 
            ref={inputRef} 
            id="form-banner-upload-input"
            type="file" 
            accept="image/jpeg,image/png,image/webp" 
            multiple={displayMode === 'slider'}
            onChange={onSelect} 
            className="hidden" 
          />
        </div>
        
        {/* Empty State */}
        {!hasImages && (
          <label 
            htmlFor="form-banner-upload-input"
            className="mt-4 flex flex-col items-center justify-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors touch-manipulation bg-gray-50 dark:bg-gray-800/50"
          >
            <div className="w-14 h-14 rounded-xl bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center mb-3">
              <ImagePlus className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">اضغط لإضافة صور الغلاف</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">حتى {maxFiles} صور • {maxSizeMB}MB لكل صورة</p>
          </label>
        )}
      </div>

      {/* Images Grid */}
      <AnimatePresence>
        {hasImages && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          >
            {banners.map((banner, i) => {
              const previewUrl = getPreviewUrl(banner);
              const isFile = typeof banner !== 'string';
              const isPrimary = i === 0;
              
              return (
                <motion.div 
                  key={`banner-${i}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "group relative rounded-xl overflow-hidden border-2 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow",
                    isPrimary 
                      ? "border-indigo-400 ring-2 ring-indigo-100 dark:ring-indigo-900/30"
                      : isFile 
                        ? "border-dashed border-indigo-300 dark:border-indigo-700"
                        : "border-gray-200 dark:border-gray-700"
                  )}
                >
                  {/* Image */}
                  <div className="relative w-full h-28">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={previewUrl} 
                      alt={`بانر ${i + 1}`} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  {/* Primary Badge */}
                  {isPrimary && (
                    <span className="absolute top-2 right-2 bg-indigo-500 text-white text-[10px] px-2 py-1 rounded-md font-medium shadow-sm flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      رئيسي
                    </span>
                  )}
                  
                  {/* New Badge for Files */}
                  {isFile && !isPrimary && (
                    <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] px-2 py-1 rounded-md font-medium shadow-sm">
                      جديد
                    </span>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="absolute top-2 left-2 flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isPrimary && (
                      <button 
                        type="button"
                        onClick={() => setAsPrimary(i)} 
                        className="bg-white hover:bg-indigo-500 hover:text-white rounded-lg p-1.5 transition-colors shadow-md active:scale-95 touch-manipulation"
                        title="تعيين كصورة رئيسية"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={() => removeAt(i)} 
                      className="bg-white hover:bg-red-500 hover:text-white rounded-lg p-1.5 transition-colors shadow-md active:scale-95 touch-manipulation"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const MemoizedFormBannersUpload = memo(FormBannersUpload);
export default MemoizedFormBannersUpload;
