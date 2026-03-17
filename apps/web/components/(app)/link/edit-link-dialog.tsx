'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  ExternalLink,
  Copy,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getBrandByKey,
  getLocalIconPathByKey,
  type BrandInfo,
} from '@/lib/brand-icons';
import { useToast } from '@/components/ui/toast';
import { updateSocialLink } from '@/lib/api/social-links';

/* ------------------------------------------------------------------ */
/*  Brand SVG Icon component                                           */
/* ------------------------------------------------------------------ */

function BrandIcon({
  brand,
  className,
}: {
  brand: BrandInfo;
  className?: string;
}) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-label={brand.title}
      className={className}
    >
      <path d={brand.path} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  EditLinkDialog                                                     */
/* ------------------------------------------------------------------ */

interface EditLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkId?: string;
  platform?: string;
  url?: string;
  title?: string | null;
  onEditSuccess?: () => void;
}

export function EditLinkDialog({
  open,
  onOpenChange,
  linkId,
  platform = 'custom',
  url = '',
  title = '',
  onEditSuccess,
}: EditLinkDialogProps) {
  const [editUrl, setEditUrl] = useState(url);
  const [editTitle, setEditTitle] = useState(title || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { show: showToast } = useToast();

  const brand = getBrandByKey(platform);
  const localIconPath = getLocalIconPathByKey(platform);
  const displayBrandTitle = brand?.title || platform;

  // Focus title input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
  }, [open]);

  // Update state when props change
  useEffect(() => {
    if (open) {
      setEditUrl(url);
      setEditTitle(title || '');
    }
  }, [open, url, title]);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(editUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleOpenUrl = () => {
    window.open(editUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSave = useCallback(async () => {
    if (!linkId) return;

    // Validation
    if (!editUrl.trim()) {
      showToast({
        title: 'خطأ',
        message: 'الرابط مطلوب',
        variant: 'error',
      });
      return;
    }

    try {
      setIsSaving(true);

      // Normalize URL
      const normalizedUrl = /^https?:\/\//i.test(editUrl)
        ? editUrl
        : `https://${editUrl}`;

      await updateSocialLink(linkId, {
        url: normalizedUrl,
        title: editTitle.trim() || displayBrandTitle,
      });

      showToast({
        title: 'تم الحفظ',
        message: 'تم تحديث الرابط بنجاح',
        variant: 'success',
      });

      onOpenChange(false);
      onEditSuccess?.();
    } catch (error) {
      console.error('Failed to update link:', error);
      showToast({
        title: 'خطأ',
        message: 'فشل تحديث الرابط',
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [linkId, editUrl, editTitle, displayBrandTitle, onOpenChange, onEditSuccess, showToast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSaving) {
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg rounded-4xl p-0 gap-0 overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <DialogTitle className="text-lg font-bold">تعديل الرابط</DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-center w-8 h-8 rounded-2xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-6 space-y-5">
          {/* Brand info */}
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/40 border border-border/30">
            {localIconPath ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-white dark:bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={localIconPath}
                  alt={displayBrandTitle}
                  width={24}
                  height={24}
                  className="h-6 w-6"
                />
              </div>
            ) : brand ? (
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `#${brand.hex}` }}
              >
                <BrandIcon brand={brand} className="h-6 w-6 text-white" />
              </div>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                <ExternalLink className="h-5 w-5 text-muted-foreground" />
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-foreground">
                {displayBrandTitle}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                عدّل اسم الرابط والعنوان
              </p>
            </div>
          </div>

          {/* Title field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">
              اسم الرابط
            </label>
            <input
              ref={titleInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value.slice(0, 50))}
              onKeyDown={handleKeyDown}
              placeholder={displayBrandTitle}
              className={cn(
                'w-full px-4 py-3 rounded-xl border border-border/50 bg-card text-foreground placeholder:text-muted-foreground/60',
                'outline-none transition-colors focus:border-foreground/30 focus:bg-muted/30',
                'text-sm'
              )}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              {editTitle.length}/50 حرف بحد أقصى
            </p>
          </div>

          {/* URL field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">
              الرابط
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-4 py-3 focus-within:border-foreground/30 focus-within:bg-muted/30 transition-colors">
              <input
                type="text"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://example.com"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
                dir="ltr"
              />
              <button
                onClick={handleCopyUrl}
                className={cn(
                  'shrink-0 transition-colors',
                  isCopied
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title={isCopied ? 'تم النسخ' : 'نسخ'}
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={handleOpenUrl}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title="فتح الرابط"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="flex-1 px-4 py-3 rounded-xl border border-border/50 bg-card text-foreground font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !editUrl.trim()}
              className="flex-1 px-4 py-3 rounded-xl bg-foreground text-background font-medium transition-colors hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري...
                </>
              ) : (
                'حفظ'
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
