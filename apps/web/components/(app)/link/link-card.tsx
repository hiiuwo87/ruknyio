'use client';

import React, { useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import {
  Eye,
  Edit2,
  Trash2,
  ExternalLink,
  Copy,
  GripVertical,
  Share2,
  Image,
  Star,
  CalendarClock,
  BarChart3,
  MousePointerClick,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getBrandByKey,
  getLocalIconPathByKey,
  extractDomain,
  getFaviconUrl,
  type BrandInfo,
} from '@/lib/brand-icons';
import { Switch } from '@/components/ui/switch';

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
/*  LinkCard                                                           */
/* ------------------------------------------------------------------ */

interface LinkCardProps {
  reorderValue?: unknown;
  id: string;
  platform: string;
  url: string;
  title?: string;
  status?: 'active' | 'hidden';
  isFeatured?: boolean;
  totalClicks?: number;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleStatus?: (id: string, status: string) => void;
  onToggleFeatured?: (id: string, featured: boolean) => void;
  onShare?: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
}

export function LinkCard({
  reorderValue,
  id,
  platform,
  url,
  title,
  status = 'active',
  isFeatured = false,
  totalClicks = 0,
  onEdit,
  onDelete,
  onToggleStatus,
  onToggleFeatured,
  onShare,
  onDragStart: parentOnDragStart,
  onDragEnd: parentOnDragEnd,
}: LinkCardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isLocalFeatured, setIsLocalFeatured] = useState(isFeatured);
  const brand = getBrandByKey(platform);
  const localIconPath = getLocalIconPathByKey(platform);
  const domain = (!localIconPath && !brand) ? extractDomain(url) : null;
  const displayTitle = title || brand?.title || platform;
  const isHidden = status === 'hidden';
  const dragControls = useDragControls();

  const handleToggleFeatured = () => {
    const newFeaturedState = !isLocalFeatured;
    setIsLocalFeatured(newFeaturedState);
    onToggleFeatured?.(id, newFeaturedState);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleOpenUrl = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Reorder.Item
      value={reorderValue ?? id}
      dragListener={false}
      dragControls={dragControls}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 35 }}
      className={cn(
        'group rounded-[26px] border p-4 transition-all cursor-default outline-none select-none',
        'data-[dragging=true]:z-10 data-[dragging=true]:shadow-lg data-[dragging=true]:scale-[1.02] data-[dragging=true]:opacity-80',
        isHidden
          ? 'border-border/40 bg-muted/25 opacity-70'
          : 'border-border/60 bg-card',
        isLocalFeatured && !isHidden && 'border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          onPointerDown={(e: any) => {
            e.preventDefault();
            dragControls.start(e);
          }}
          className="mt-0.5 h-8 w-6 shrink-0 text-muted-foreground/65 transition-colors hover:text-foreground cursor-grab active:cursor-grabbing flex items-center justify-center touch-none p-1 -m-1 rounded-lg hover:bg-muted"
          title="إعادة ترتيب"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-center gap-2">
            {localIconPath ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/50 bg-white dark:bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={localIconPath}
                  alt={displayTitle}
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px]"
                />
              </div>
            ) : brand ? (
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `#${brand.hex}` }}
              >
                <BrandIcon brand={brand} className="h-[18px] w-[18px] text-white" />
              </div>
            ) : domain ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/50 bg-white dark:bg-zinc-900 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getFaviconUrl(domain, 64)}
                  alt={domain}
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] object-contain"
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    el.style.display = 'none';
                    el.parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>';
                  }}
                />
              </div>
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            )}

            <p className="min-w-0 flex-1 truncate text-[18px] leading-tight font-semibold text-foreground">
              {displayTitle}
            </p>

            {onEdit && (
              <button
                onClick={() => onEdit(id)}
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                title="تعديل العنوان"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ps-11">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-[15px] leading-tight text-foreground/90 hover:text-foreground"
              dir="ltr"
              title={url}
            >
              {url}
            </a>

            <button
              onClick={handleCopyUrl}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              title={isCopied ? 'تم النسخ' : 'نسخ الرابط'}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>

            {onEdit && (
              <button
                onClick={() => onEdit(id)}
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                title="تعديل الرابط"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 ps-11 text-muted-foreground">
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-muted hover:text-foreground"
              title="فتح الرابط"
              onClick={handleOpenUrl}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-muted hover:text-foreground"
              title="خيارات الرابط"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg text-violet-600 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/40"
              title="صورة الرابط"
            >
              <Image className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleToggleFeatured}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                isLocalFeatured
                  ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-500'
                  : 'hover:bg-muted hover:text-foreground',
              )}
              title={isLocalFeatured ? 'إزالة من المميز' : 'جعل مميز'}
            >
              <Star className={cn('h-3.5 w-3.5', isLocalFeatured && 'fill-current')} />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors hover:bg-muted hover:text-foreground"
              title="الجدولة"
            >
              <CalendarClock className="h-3.5 w-3.5" />
            </button>
            <div className="ms-1 inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/35 px-2.5 py-1 text-xs font-medium text-foreground/85">
              <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{totalClicks}</span>
              <span className="text-muted-foreground">نقرة</span>
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="flex min-h-[92px] flex-col items-center justify-between gap-2">
          <button
            type="button"
            className="text-muted-foreground transition-colors hover:text-foreground"
            title="مشاركة"
            onClick={() => onShare?.(id)}
          >
            <Share2 className="h-4 w-4" />
          </button>

          {onToggleStatus && (
            <Switch
              checked={!isHidden}
              onCheckedChange={(checked) =>
                onToggleStatus(id, checked ? 'active' : 'hidden')
              }
              aria-label={isHidden ? 'إظهار الرابط' : 'إخفاء الرابط'}
              title={isHidden ? 'إظهار' : 'إخفاء'}
            />
          )}

          {onDelete && (
            <button
              onClick={() => onDelete(id)}
              className="text-muted-foreground transition-colors hover:text-destructive"
              title="حذف"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </Reorder.Item>
    );
  }
