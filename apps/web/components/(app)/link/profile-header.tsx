'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, Reorder } from 'framer-motion';
import {
  Instagram,
  Youtube,
  Mail,
  Link2,
  Plus,
  ChevronLeft,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { API_URL } from '@/lib/config';
import { AddLinkDialog } from './add-link-dialog';
import { EditLinkDialog } from './edit-link-dialog';
import { LinkCard } from './link-card';
import { InstagramBlocksList } from './instagram-blocks';
import { getMyLinks, deleteSocialLink, updateSocialLink, reorderSocialLinks } from '@/lib/api/social-links';
import { useToast } from '@/components/ui/toast';
import { usePhonePreview, type ProfileData } from '@/components/(app)/shared/phone-preview-context';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  title?: string | null;
  displayOrder: number;
  status?: string;
  totalClicks?: number;
}

/* ------------------------------------------------------------------ */
/*  Social platform icons                                              */
/* ------------------------------------------------------------------ */

/* TikTok SVG — lucide doesn't include it */
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

const platformIcons: Record<string, LucideIcon | ((p: { className?: string }) => React.ReactElement)> = {
  instagram: Instagram,
  tiktok: TikTokIcon,
  youtube: Youtube,
  email: Mail,
  custom: Link2,
};

const getPlatformIcon = (platform: string) =>
  platformIcons[platform] ?? platformIcons.custom;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const getInitials = (name: string): string =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/* ------------------------------------------------------------------ */
/*  ProfileHeader                                                      */
/* ------------------------------------------------------------------ */

export function ProfileHeader() {
  const { user } = useAuth();
  const { show: showToast } = useToast();
  const { profile, setProfile } = usePhonePreview();
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  // Fetch profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/profiles/me`, { credentials: 'include' });
        if (res.ok) {
          setProfile(await res.json());
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user?.id]);

  // Fetch links when dialog opens or after adding
  const loadLinks = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getMyLinks();
      setLinks(data);
      // Update profile with new links for PhonePreview
      if (profile) {
        setProfile({ ...profile, socialLinks: data });
      }
    } catch (error) {
      console.error('Failed to load links:', error);
    }
  }, [user?.id, profile, setProfile]);

  useEffect(() => {
    if (showAddDialog) {
      loadLinks();
    }
  }, [showAddDialog, loadLinks]);

  // Load links on component mount
  useEffect(() => {
    const loadInitialLinks = async () => {
      if (!user?.id) return;
      try {
        const data = await getMyLinks();
        setLinks(data);
      } catch (error) {
        console.error('Failed to load links:', error);
      }
    };

    loadInitialLinks();
  }, [user?.id]);

  const handleAddSuccess = useCallback(async () => {
    await loadLinks();
    setShowAddDialog(false);
    showToast({
      title: 'تم إضافة الرابط',
      message: 'تم إضافة الرابط بنجاح إلى ملفك',
      variant: 'success',
    });
  }, [loadLinks, showToast]);

  const handleDeleteLink = useCallback(
    async (id: string) => {
      try {
        await deleteSocialLink(id);
        await loadLinks();
        showToast({
          title: 'تم الحذف',
          message: 'تم حذف الرابط بنجاح',
          variant: 'success',
        });
      } catch (error) {
        console.error('Failed to delete link:', error);
        showToast({
          title: 'خطأ',
          message: 'فشل حذف الرابط',
          variant: 'error',
        });
      }
    },
    [loadLinks, showToast],
  );

  const handleEditLink = useCallback(
    (id: string) => {
      setEditingLinkId(id);
      setShowEditDialog(true);
    },
    [],
  );

  const handleReorder = useCallback(
    async (newOrder: SocialLink[]) => {
      const reordered = newOrder.map((link, index) => ({ ...link, displayOrder: index }));
      // Optimistic update
      setLinks(reordered);
      if (profile) {
        setProfile({ ...profile, socialLinks: reordered });
      }
      // Persist to backend (fire-and-forget, silent on error)
      try {
        await reorderSocialLinks(reordered.map((l) => l.id));
      } catch {
        // silently ignore — order will resync on next loadLinks
      }
    },
    [profile, setProfile],
  );

  const editingLink = editingLinkId ? links.find((l) => l.id === editingLinkId) : null;

  const handleToggleStatus = useCallback(
    async (id: string, newStatus: string) => {
      // Store previous state for rollback
      const previousLinks = links;
      const previousProfile = profile;

      try {
        // Optimistic update - update UI immediately
        setLinks((prevLinks) =>
          prevLinks.map((link) =>
            link.id === id ? { ...link, status: newStatus } : link
          )
        );

        if (profile) {
          setProfile({
            ...profile,
            socialLinks: profile.socialLinks.map((link) =>
              link.id === id ? { ...link, status: newStatus } : link
            ),
          });
        }

        // Then call API
        await updateSocialLink(id, { status: newStatus as 'active' | 'hidden' });
      } catch (error) {
        console.error('Failed to update link status:', error);
        // Rollback on error
        setLinks(previousLinks);
        if (previousProfile) {
          setProfile(previousProfile);
        }
        showToast({
          title: 'خطأ',
          message: 'فشل تحديث حالة الرابط',
          variant: 'error',
        });
      }
    },
    [links, profile, showToast, setProfile],
  );

  const displayName =
    profile?.name ||
    profile?.user?.name ||
    user?.name ||
    profile?.username ||
    user?.username ||
    'المستخدم';
  const displayUsername = profile?.username || user?.username || '';
  const displayAvatar = profile?.avatar ?? user?.avatar;
  const socialLinks = profile?.socialLinks ?? [];

  /* ---- Skeleton -------------------------------------------------- */
  if (loading) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-muted shrink-0" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted rounded-md" />
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-5 h-5 rounded bg-muted" />
              ))}
            </div>
          </div>
        </div>
        <div className="h-12 w-full bg-muted rounded-full" />
        <div className="flex justify-between">
          <div className="h-8 w-32 bg-muted rounded-lg" />
          <div className="h-8 w-32 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full"
    >
      {/* ── Avatar + Name + Social row ── */}
      <div className="flex items-center mt-8 gap-4 py-3">
        {/* Avatar */}
        <Avatar className="w-14 h-14 shrink-0">
          {displayAvatar && (
            <AvatarImage src={displayAvatar} alt={displayName} />
          )}
          <AvatarFallback className="text-base font-bold text-primary-foreground bg-gradient-to-br from-primary to-primary/80">
            {getInitials(displayName)}
          </AvatarFallback>
        </Avatar>

        {/* Name & social icons */}
        <div className="min-w-0 flex-1">
          {displayUsername && (
            <p className="text-sm font-semibold text-foreground w-fit" dir="ltr">
              @{displayUsername}
            </p>
          )}

          {/* Social icons row */}
          <div className="flex items-center gap-2.5 mt-1.5">
            {socialLinks.slice(0, 5).map((link) => {
              const Icon = getPlatformIcon(link.platform);
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative flex items-center justify-center text-muted-foreground/70 hover:text-foreground transition-colors"
                  title={link.title || link.platform}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span className="absolute -top-1 -end-1.5 text-muted-foreground/60 text-[9px] font-semibold leading-none select-none">
                    +
                  </span>
                </a>
              );
            })}

            {/* Add more link */}
            <button
              className="flex items-center justify-center w-6 h-6 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground/40 hover:border-foreground/40 hover:text-foreground transition-colors"
              aria-label="إضافة رابط"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Add Button (CTA) ── */}
      <button
        onClick={() => setShowAddDialog(true)}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-full bg-foreground text-background font-semibold text-sm hover:bg-foreground/90 active:scale-[0.98] transition-all cursor-pointer"
      >
        <Plus className="w-5 h-5" />
        Add
      </button>

      <AddLinkDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        onAddSuccess={handleAddSuccess}
      />

      <EditLinkDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        linkId={editingLinkId ?? undefined}
        platform={editingLink?.platform}
        url={editingLink?.url}
        title={editingLink?.title}
        onEditSuccess={loadLinks}
      />

      {/* ── Bottom Actions ── */}
      <div className="mt-4 flex items-center justify-between">
        <button className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <line x1="3" y1="9" x2="21" y2="9" />
          </svg>
          Add collection
        </button>

        <button className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          View archive
          <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
        </button>
      </div>

      {/* ── Links Display ── */}
      {links.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">روابطك</h3>
          <Reorder.Group
            axis="y"
            values={links}
            onReorder={handleReorder}
            className="space-y-3"
          >
            {links.map((link) => (
              <LinkCard
                key={link.id}
                reorderValue={link}
                id={link.id}
                platform={link.platform}
                url={link.url}
                title={link.title ?? undefined}
                status={link.status as 'active' | 'hidden' | undefined}
                isFeatured={false}
                totalClicks={link.totalClicks}
                onDelete={handleDeleteLink}
                onToggleStatus={handleToggleStatus}
                onToggleFeatured={(id, featured) =>
                  console.log(`Link ${id} featured: ${featured}`)
                }
                onShare={(id) => console.log(`Share link: ${id}`)}
                onEdit={handleEditLink}
                onDragStart={(id) => console.log(`Drag start: ${id}`)}
                onDragEnd={() => console.log('Drag end')}
              />
            ))}
          </Reorder.Group>
        </div>
      )}

      {/* ── Instagram Blocks ── */}
      <div className="mt-6">
        <InstagramBlocksList />
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton export                                                    */
/* ------------------------------------------------------------------ */

export function ProfileHeaderSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-muted shrink-0" />
        <div className="space-y-2">
          <div className="h-4 w-24 bg-muted rounded-md" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-5 h-5 rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
      <div className="h-12 w-full bg-muted rounded-full" />
      <div className="flex justify-between">
        <div className="h-8 w-32 bg-muted rounded-lg" />
        <div className="h-8 w-32 bg-muted rounded-lg" />
      </div>
    </div>
  );
}
