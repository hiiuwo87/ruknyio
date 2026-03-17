'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  Images,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
  Link2,
  X,
  ExternalLink,
  Heart,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import {
  getInstagramBlocks,
  getInstagramMedia,
  deleteInstagramBlock,
  toggleInstagramBlock,
  setInstagramGridLink,
  removeInstagramGridLink,
  type InstagramBlock,
  type InstagramMedia,
} from '@/lib/api/instagram';

/* ------------------------------------------------------------------ */
/*  Grid Link Editor Modal                                             */
/* ------------------------------------------------------------------ */

function GridLinkEditor({
  media,
  existingLink,
  onSave,
  onRemove,
  onClose,
}: {
  media: InstagramMedia;
  existingLink: { linkUrl: string | null; linkTitle: string | null } | null;
  onSave: (linkUrl: string, linkTitle?: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onClose: () => void;
}) {
  const [linkUrl, setLinkUrl] = useState(existingLink?.linkUrl || '');
  const [linkTitle, setLinkTitle] = useState(existingLink?.linkTitle || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!linkUrl.trim()) return;
    setSaving(true);
    try {
      await onSave(linkUrl.trim(), linkTitle.trim() || undefined);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await onRemove();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-background rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">إضافة رابط للمنشور</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.thumbnail_url || media.media_url}
            alt=""
            className="w-14 h-14 rounded-lg object-cover"
          />
          <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
            {media.caption || 'بدون وصف'}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">الرابط</label>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com/product"
              dir="ltr"
              className="w-full h-10 px-3 rounded-xl bg-muted/40 border border-border text-sm outline-none focus:border-foreground/30 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              عنوان الرابط (اختياري)
            </label>
            <input
              type="text"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="اسم المنتج أو الفعالية"
              className="w-full h-10 px-3 rounded-xl bg-muted/40 border border-border text-sm outline-none focus:border-foreground/30 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !linkUrl.trim()}
            className="flex-1 h-10 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ'}
          </button>
          {existingLink?.linkUrl && (
            <button
              onClick={handleRemove}
              disabled={saving}
              className="h-10 px-4 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              إزالة
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Instagram Block Card                                               */
/* ------------------------------------------------------------------ */

function InstagramBlockCard({
  block,
  onDelete,
  onToggle,
  onRefresh,
}: {
  block: InstagramBlock;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onRefresh: () => void;
}) {
  const [media, setMedia] = useState<InstagramMedia[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [editingMedia, setEditingMedia] = useState<InstagramMedia | null>(null);
  const { show: showToast } = useToast();

  // Fetch media when block is visible
  useEffect(() => {
    const fetchMedia = async () => {
      try {
        setLoadingMedia(true);
        const result = await getInstagramMedia(block.type === 'GRID' ? 9 : 6);
        setMedia(result.data || []);
      } catch {
        // ignore - will show empty state
      } finally {
        setLoadingMedia(false);
      }
    };
    fetchMedia();
  }, [block.type]);

  const handleSaveLink = useCallback(
    async (mediaId: string, linkUrl: string, linkTitle?: string) => {
      try {
        await setInstagramGridLink(block.id, mediaId, linkUrl, linkTitle);
        showToast({ title: 'تم الحفظ', message: 'تم حفظ الرابط', variant: 'success' });
        onRefresh();
      } catch {
        showToast({ title: 'خطأ', message: 'فشل حفظ الرابط', variant: 'error' });
      }
    },
    [block.id, showToast, onRefresh],
  );

  const handleRemoveLink = useCallback(
    async (mediaId: string) => {
      try {
        await removeInstagramGridLink(block.id, mediaId);
        showToast({ title: 'تم الحذف', message: 'تم إزالة الرابط', variant: 'success' });
        onRefresh();
      } catch {
        showToast({ title: 'خطأ', message: 'فشل إزالة الرابط', variant: 'error' });
      }
    },
    [block.id, showToast, onRefresh],
  );

  const getGridLinkForMedia = (mediaId: string) => {
    return block.gridLinks.find((gl) => gl.mediaId === mediaId) || null;
  };

  const isGrid = block.type === 'GRID';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'rounded-2xl border overflow-hidden transition-all',
        block.isActive
          ? 'border-border bg-card'
          : 'border-border/40 bg-muted/30 opacity-70',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/instagram.svg" alt="Instagram" className="w-6 h-6" />
          <div>
            <p className="text-sm font-semibold">
              {isGrid ? 'شبكة إنستغرام' : 'معرض إنستغرام'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {isGrid ? 'شبكة منشورات مع روابط' : 'أحدث المنشورات'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggle(block.id)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={block.isActive ? 'إخفاء' : 'إظهار'}
          >
            {block.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onDelete(block.id)}
            className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
            title="حذف"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Media Grid/Feed */}
      <div className="p-3">
        {loadingMedia ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : media.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Images className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">لا توجد منشورات</p>
          </div>
        ) : isGrid ? (
          /* ─── Grid View (3x3) ─── */
          <div className="grid grid-cols-3 gap-1.5">
            {media.slice(0, 9).map((item) => {
              const gridLink = getGridLinkForMedia(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => setEditingMedia(item)}
                  className="relative aspect-square rounded-lg overflow-hidden group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbnail_url || item.media_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {/* Link indicator */}
                  {gridLink?.linkUrl && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <Link2 className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {/* Video indicator */}
                  {item.media_type === 'VIDEO' && (
                    <div className="absolute top-1 left-1 text-white/80">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          /* ─── Feed View (horizontal scroll) ─── */
          <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden">
            {media.slice(0, 6).map((item) => (
              <a
                key={item.id}
                href={item.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 w-36 rounded-xl overflow-hidden border border-border/40 hover:shadow-md transition-shadow group"
              >
                <div className="relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbnail_url || item.media_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {item.media_type === 'VIDEO' && (
                    <div className="absolute top-1.5 left-1.5 text-white/80">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <ExternalLink className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.caption || 'بدون وصف'}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground/60">
                    {item.like_count != null && (
                      <span className="flex items-center gap-0.5">
                        <Heart className="w-2.5 h-2.5" /> {item.like_count}
                      </span>
                    )}
                    {item.comments_count != null && (
                      <span className="flex items-center gap-0.5">
                        <MessageCircle className="w-2.5 h-2.5" /> {item.comments_count}
                      </span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Grid Link Editor Modal */}
      <AnimatePresence>
        {editingMedia && (
          <GridLinkEditor
            media={editingMedia}
            existingLink={getGridLinkForMedia(editingMedia.id)}
            onSave={(linkUrl, linkTitle) =>
              handleSaveLink(editingMedia.id, linkUrl, linkTitle)
            }
            onRemove={() => handleRemoveLink(editingMedia.id)}
            onClose={() => setEditingMedia(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Instagram Blocks List                                              */
/* ------------------------------------------------------------------ */

export function InstagramBlocksList() {
  const [blocks, setBlocks] = useState<InstagramBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const { show: showToast } = useToast();

  const fetchBlocks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getInstagramBlocks();
      setBlocks(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const handleDelete = useCallback(
    async (blockId: string) => {
      try {
        await deleteInstagramBlock(blockId);
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
        showToast({ title: 'تم الحذف', message: 'تم حذف البلوك', variant: 'success' });
      } catch {
        showToast({ title: 'خطأ', message: 'فشل الحذف', variant: 'error' });
      }
    },
    [showToast],
  );

  const handleToggle = useCallback(
    async (blockId: string) => {
      try {
        await toggleInstagramBlock(blockId);
        setBlocks((prev) =>
          prev.map((b) => (b.id === blockId ? { ...b, isActive: !b.isActive } : b)),
        );
      } catch {
        showToast({ title: 'خطأ', message: 'فشل التحديث', variant: 'error' });
      }
    },
    [showToast],
  );

  if (loading) return null;
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {blocks.map((block) => (
          <InstagramBlockCard
            key={block.id}
            block={block}
            onDelete={handleDelete}
            onToggle={handleToggle}
            onRefresh={fetchBlocks}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
