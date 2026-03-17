'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  PlayCircle,
  MessageSquare,
  CalendarDays,
  Type,
  MoreHorizontal,
  ShoppingBag,
  Sparkles,
  Globe,
  Mail,
  Link2,
  Loader2,
  LayoutGrid,
  Images,
  CheckCircle2,
  LogIn,
  Unplug,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getBrandByKey,
  detectPlatformKeyFromUrl,
  extractDomain,
  getFaviconUrl,
  getLocalIconPathByKey,
  type BrandInfo,
} from '@/lib/brand-icons';
import { useToast } from '@/components/ui/toast';
import { createSocialLink } from '@/lib/api/social-links';
import {
  getInstagramStatus,
  createInstagramBlock,
  type InstagramConnection,
} from '@/lib/api/instagram';
import { API_EXTERNAL_URL } from '@/lib/config';

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
/*  Data                                                               */
/* ------------------------------------------------------------------ */

interface CategoryItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface LinkItemData {
  id: string;
  /** simple-icons key (used for getBrandByKey) */
  brandKey: string;
  name: string;
  description: string;
  /** Fallback bg color when brand not found */
  fallbackBg?: string;
  category: string[];
}

const categories: CategoryItem[] = [
  { id: 'suggested', label: 'مقترحات', icon: Sparkles },
  { id: 'commerce',  label: 'تجارة',   icon: ShoppingBag },
  { id: 'social',    label: 'اجتماعي', icon: Heart },
  { id: 'media',     label: 'ميديا',   icon: PlayCircle },
  { id: 'contact',   label: 'تواصل',   icon: MessageSquare },
  { id: 'events',    label: 'فعاليات', icon: CalendarDays },
  { id: 'text',      label: 'نص',      icon: Type },
  { id: 'all',       label: 'الكل',    icon: MoreHorizontal },
];

const linkItems: LinkItemData[] = [
  { id: 'instagram',  brandKey: 'instagram',  name: 'Instagram',         description: 'اعرض منشوراتك و Reels',        category: ['suggested', 'social'] },
  { id: 'tiktok',     brandKey: 'tiktok',     name: 'TikTok',            description: 'شارك فيديوهاتك على TikTok',    category: ['suggested', 'social', 'media'] },
  { id: 'youtube',    brandKey: 'youtube',    name: 'YouTube',           description: 'شارك فيديوهات YouTube',        category: ['suggested', 'social', 'media'] },
  { id: 'x',          brandKey: 'x',          name: 'X',                 description: 'شارك تغريداتك',                category: ['suggested', 'social'] },
  { id: 'snapchat',   brandKey: 'snapchat',   name: 'Snapchat',         description: 'شارك Snapchat الخاص بك',       category: ['suggested', 'social'] },
  { id: 'threads',    brandKey: 'threads',     name: 'Threads',          description: 'شارك ملفك على Threads',        category: ['social'] },
  { id: 'facebook',   brandKey: 'facebook',   name: 'Facebook',         description: 'صفحتك أو ملفك الشخصي',         category: ['social'] },
  { id: 'linkedin',   brandKey: 'linkedin',   name: 'LinkedIn',         description: 'اعرض ملفك المهني',             category: ['social'], fallbackBg: '#0A66C2' },
  { id: 'github',     brandKey: 'github',     name: 'GitHub',           description: 'شارك مشاريعك البرمجية',        category: ['social'] },
  { id: 'whatsapp',   brandKey: 'whatsapp',   name: 'WhatsApp',         description: 'رابط دردشة مباشرة',            category: ['contact', 'suggested'] },
  { id: 'telegram',   brandKey: 'telegram',   name: 'Telegram',         description: 'قناتك أو حسابك على Telegram',  category: ['contact'] },
  { id: 'discord',    brandKey: 'discord',    name: 'Discord',          description: 'انضم لسيرفر Discord',          category: ['contact'] },
  { id: 'spotify',    brandKey: 'spotify',    name: 'Spotify',          description: 'شارك بودكاست أو بلايلست',      category: ['media'] },
  { id: 'twitch',     brandKey: 'twitch',     name: 'Twitch',           description: 'قناة البث المباشر',            category: ['media'] },
  { id: 'soundcloud', brandKey: 'soundcloud', name: 'SoundCloud',       description: 'شارك مقاطعك الصوتية',          category: ['media'] },
  { id: 'pinterest',  brandKey: 'pinterest',  name: 'Pinterest',        description: 'شارك لوحاتك الإبداعية',        category: ['social'] },
  { id: 'reddit',     brandKey: 'reddit',     name: 'Reddit',           description: 'ملفك على Reddit',              category: ['social'] },
  { id: 'behance',    brandKey: 'behance',    name: 'Behance',          description: 'اعرض أعمالك التصميمية',        category: ['social', 'media'] },
  { id: 'dribbble',   brandKey: 'dribbble',   name: 'Dribbble',         description: 'اعرض تصاميمك',                 category: ['social', 'media'] },
  { id: 'figma',      brandKey: 'figma',      name: 'Figma',            description: 'شارك ملفات التصميم',           category: ['media'] },
  { id: 'notion',     brandKey: 'notion',     name: 'Notion',           description: 'صفحة Notion الخاصة بك',        category: ['commerce'] },
  { id: 'shopify',    brandKey: 'shopify',    name: 'Shopify',          description: 'رابط متجرك على Shopify',       category: ['commerce'] },
  { id: 'etsy',       brandKey: 'etsy',       name: 'Etsy',             description: 'متجرك على Etsy',               category: ['commerce'] },
  { id: 'patreon',    brandKey: 'patreon',    name: 'Patreon',          description: 'صفحة الدعم على Patreon',       category: ['commerce'] },
  { id: 'substack',   brandKey: 'substack',   name: 'Substack',         description: 'نشرتك البريدية',               category: ['media', 'commerce'] },
  { id: 'calendly',   brandKey: 'calendly',   name: 'Calendly',         description: 'حجز مواعيد',                   category: ['events'] },
  { id: 'zoom',       brandKey: 'zoom',       name: 'Zoom',             description: 'رابط اجتماع Zoom',             category: ['events', 'contact'] },
  { id: 'email',      brandKey: 'gmail',      name: 'البريد الإلكتروني', description: 'أضف بريدك الإلكتروني',         category: ['contact'] },
  { id: 'website',    brandKey: '_website',    name: 'موقع إلكتروني',    description: 'أضف رابط موقعك',               category: ['suggested', 'commerce'] },
];

function normalizeUrl(input: string): string {
  const value = input.trim();
  if (!value) return value;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function inferUsernameFromUrl(rawUrl: string, platformKey?: string): string {
  try {
    const url = new URL(normalizeUrl(rawUrl));
    const pathSegments = url.pathname.split('/').filter(Boolean);

    if (platformKey === 'youtube' && url.searchParams.get('v')) {
      return `video_${url.searchParams.get('v')}`.slice(0, 100);
    }

    const preferred =
      pathSegments[pathSegments.length - 1] ||
      pathSegments[0] ||
      url.hostname.replace(/^www\./i, '').split('.')[0] ||
      'link';

    return preferred.replace(/^@/, '').slice(0, 100);
  } catch {
    return 'link';
  }
}

/* ------------------------------------------------------------------ */
/*  Instagram Sub-View                                                 */
/* ------------------------------------------------------------------ */

const instagramOptions = [
  {
    id: 'grid' as const,
    Icon: LayoutGrid,
    title: 'استنساخ شبكة إنستغرام وإضافة روابط',
    description:
      'اعرض شبكة منشوراتك وأضف روابط للمنتجات والفعاليات والمقالات، حتى يتمكن متابعوك من التسوق منها.',
    coming: false,
    requiresAuth: true,
  },
  {
    id: 'feed' as const,
    Icon: Images,
    title: 'مشاركة أحدث المنشورات أو Reels بشكل مرئي',
    description:
      'اعرض معرض منشوراتك أو Reels لإرسال الزوار مباشرة إلى ملفك الشخصي واستكشاف محتواك.',
    coming: false,
    requiresAuth: true,
  },
  {
    id: 'link' as const,
    Icon: Link2,
    title: 'رابط بسيط لملفي الشخصي',
    description: 'وجّه الزوار مباشرة إلى ملفك الشخصي على إنستغرام عبر رابط كلاسيكي.',
    coming: false,
    requiresAuth: false,
  },
] as const;

function InstagramSubView({
  onBack,
  onAddSuccess,
}: {
  onBack: () => void;
  onAddSuccess?: () => void;
}) {
  const [activeOption, setActiveOption] = useState<'grid' | 'feed' | 'link' | null>(null);
  const [urlInput, setUrlInput] = useState('https://www.instagram.com/');
  const [isAdding, setIsAdding] = useState(false);
  const [igStatus, setIgStatus] = useState<{ connected: boolean; connection: InstagramConnection | null } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const urlRef = useRef<HTMLInputElement>(null);
  const { show: showToast } = useToast();

  // Check Instagram connection status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        setCheckingStatus(true);
        const status = await getInstagramStatus();
        setIgStatus(status);
      } catch {
        setIgStatus({ connected: false, connection: null });
      } finally {
        setCheckingStatus(false);
      }
    };
    checkStatus();
  }, []);

  useEffect(() => {
    if (activeOption === 'link') {
      setTimeout(() => urlRef.current?.focus(), 150);
    }
  }, [activeOption]);



  const handleAddSimpleLink = useCallback(async () => {
    try {
      setIsAdding(true);
      const normalizedUrl = normalizeUrl(urlInput);
      const username = inferUsernameFromUrl(normalizedUrl, 'instagram');
      await createSocialLink({
        platform: 'instagram',
        username,
        url: normalizedUrl,
        title: 'Instagram',
      });
      showToast({ title: 'تمت الإضافة', message: 'تم إضافة رابط إنستغرام', variant: 'success' });
      onAddSuccess?.();
    } catch {
      showToast({ title: 'خطأ', message: 'فشل إضافة الرابط', variant: 'error' });
    } finally {
      setIsAdding(false);
    }
  }, [urlInput, showToast, onAddSuccess]);

  const handleConnectInstagram = useCallback(() => {
    // Redirect to Instagram OAuth (via backend)
    window.location.href = `${API_EXTERNAL_URL}/integrations/instagram/auth`;
  }, []);

  const handleCreateBlock = useCallback(async (type: 'GRID' | 'FEED') => {
    try {
      setIsAdding(true);
      await createInstagramBlock(type);
      showToast({
        title: 'تمت الإضافة',
        message: type === 'GRID' ? 'تم إضافة شبكة إنستغرام' : 'تم إضافة معرض إنستغرام',
        variant: 'success',
      });
      onAddSuccess?.();
    } catch {
      showToast({ title: 'خطأ', message: 'فشل إنشاء البلوك', variant: 'error' });
    } finally {
      setIsAdding(false);
    }
  }, [showToast, onAddSuccess]);

  return (
    <motion.div
      key="instagram-sub"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="flex flex-col min-h-0 flex-1 overflow-hidden"
    >
      {/* ── Sub-header ── */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/40 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          title="رجوع"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/instagram.svg" alt="Instagram" className="w-8 h-8" />
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Instagram</span>
            {igStatus?.connected && (
              <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                متصل بـ @{igStatus.connection?.username}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Options list ── */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden p-4 space-y-2 pb-6">
        {checkingStatus ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <>
        <p className="text-xs font-medium text-muted-foreground mb-3 px-1">
          اختر كيف تريد إضافة إنستغرام
        </p>

        {instagramOptions.map((opt) => {
          const needsAuth = opt.requiresAuth && !igStatus?.connected;
          const isSelected = activeOption === opt.id;
          return (
            <div key={opt.id}>
              <button
                onClick={() => {
                  if (needsAuth) {
                    handleConnectInstagram();
                    return;
                  }
                  if (opt.id === 'grid' || opt.id === 'feed') {
                    handleCreateBlock(opt.id === 'grid' ? 'GRID' : 'FEED');
                    return;
                  }
                  setActiveOption((prev) => (prev === opt.id ? null : opt.id));
                }}
                disabled={isAdding}
                className={cn(
                  'w-full flex items-start gap-4 p-4 rounded-2xl border text-start transition-all group',
                  isSelected
                    ? 'border-foreground/40 bg-foreground/5 shadow-sm'
                    : 'border-border/50 bg-card hover:border-border hover:shadow-sm cursor-pointer',
                  isAdding && 'opacity-60 cursor-not-allowed',
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                    isSelected
                      ? 'bg-foreground text-background'
                      : needsAuth
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-muted/60 text-foreground group-hover:bg-muted',
                  )}
                >
                  {needsAuth ? (
                    <LogIn className="w-5 h-5" />
                  ) : (
                    <opt.Icon className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm leading-snug">{opt.title}</p>
                    {needsAuth && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
                        يتطلب الربط
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {needsAuth
                      ? 'اضغط هنا لربط حساب إنستغرام الخاص بك أولاً'
                      : opt.description}
                  </p>
                </div>
              </button>
            </div>
          );
        })}

        {/* ── URL input (slides in when option 3 active) ── */}
        <AnimatePresence>
          {activeOption === 'link' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="overflow-hidden"
            >
              <div className="mt-1 p-4 rounded-2xl bg-muted/40 border border-border/40 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">رابط حسابك على إنستغرام</p>
                <input
                  ref={urlRef}
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSimpleLink()}
                  placeholder="https://www.instagram.com/username"
                  dir="ltr"
                  className="w-full h-10 px-3 rounded-xl bg-background border border-border text-sm outline-none focus:border-foreground/30 transition-colors"
                />
                <button
                  onClick={handleAddSimpleLink}
                  disabled={isAdding || !urlInput.trim()}
                  className="w-full h-10 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري الإضافة...
                    </>
                  ) : (
                    'إضافة رابط إنستغرام'
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Connected account info ── */}
        {igStatus?.connected && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
            <div className="flex items-center gap-3">
              {igStatus.connection?.profilePicUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={igStatus.connection.profilePicUrl}
                  alt={igStatus.connection.username}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                  @{igStatus.connection?.username}
                </p>
                {igStatus.connection?.followersCount != null && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    {igStatus.connection.followersCount.toLocaleString()} متابع
                  </p>
                )}
              </div>
              <Unplug className="w-4 h-4 text-emerald-500 shrink-0" />
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detected URL card                                                  */
/* ------------------------------------------------------------------ */

function DetectedUrlCard({
  platformKey,
  brand,
  url,
  onAddSuccess,
}: {
  platformKey: string;
  brand: BrandInfo | null;
  url: string;
  onAddSuccess?: () => void;
}) {
  const domain = extractDomain(url);
  const localIconPath = getLocalIconPathByKey(platformKey);
  const fallbackTitle =
    linkItems.find((item) => item.brandKey === platformKey)?.name ?? platformKey;
  const [isLoading, setIsLoading] = useState(false);
  const { show: showToast } = useToast();

  const handleAdd = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Extract platform name and normalize URL
      const platformName = brand?.title || fallbackTitle;
      const normalizedUrl = normalizeUrl(url);
      const username = inferUsernameFromUrl(normalizedUrl, platformKey);
      
      await createSocialLink({
        platform: platformKey,
        username,
        url: normalizedUrl,
        title: platformName.slice(0, 50),
      });

      showToast({
        title: 'تمت الإضافة بنجاح',
        message: `تم إضافة ${platformName}`,
        variant: 'success',
      });

      onAddSuccess?.();
    } catch (error) {
      console.error('Failed to add link:', error);
      showToast({
        title: 'خطأ',
        message: 'حدث خطأ عند إضافة الرابط',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [platformKey, url, brand?.title, fallbackTitle, onAddSuccess, showToast]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/30 mb-4"
    >
      {localIconPath ? (
        <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-white dark:bg-zinc-900 border border-border/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={localIconPath} alt={fallbackTitle} width={20} height={20} className="w-5 h-5" />
        </div>
      ) : brand ? (
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
          style={{ backgroundColor: `#${brand.hex}` }}
        >
          <BrandIcon brand={brand} className="w-5 h-5 text-white" />
        </div>
      ) : (
        <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-muted">
          <Link2 className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          تم التعرف على {brand?.title ?? fallbackTitle}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate" dir="ltr">
          {domain}
        </p>
      </div>
      <button
        onClick={handleAdd}
        disabled={isLoading}
        className="px-4 py-1.5 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            جاري...
          </>
        ) : (
          'إضافة'
        )}
      </button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Unknown URL card (favicon fallback)                                */
/* ------------------------------------------------------------------ */

function UnknownUrlCard({
  url,
  onAddSuccess,
}: {
  url: string;
  onAddSuccess?: () => void;
}) {
  const domain = extractDomain(url);
  const [isLoading, setIsLoading] = useState(false);
  const { show: showToast } = useToast();

  if (!domain) return null;

  const handleAdd = useCallback(async () => {
    try {
      setIsLoading(true);
      const normalizedUrl = normalizeUrl(url);
      const username = inferUsernameFromUrl(normalizedUrl);

      await createSocialLink({
        platform: 'custom',
        username,
        url: normalizedUrl,
        title: domain.slice(0, 50),
      });

      showToast({
        title: 'تمت الإضافة بنجاح',
        message: `تم إضافة رابط ${domain}`,
        variant: 'success',
      });

      onAddSuccess?.();
    } catch (error) {
      console.error('Failed to add link:', error);
      showToast({
        title: 'خطأ',
        message: 'حدث خطأ عند إضافة الرابط',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [url, domain, showToast, onAddSuccess]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 border border-border/30 mb-4"
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getFaviconUrl(domain)}
          alt={domain}
          width={20}
          height={20}
          className="w-5 h-5 rounded-sm"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">رابط خارجي</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate" dir="ltr">
          {domain}
        </p>
      </div>
      <button
        onClick={handleAdd}
        disabled={isLoading}
        className="px-4 py-1.5 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            جاري...
          </>
        ) : (
          'إضافة'
        )}
      </button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Link item row                                                      */
/* ------------------------------------------------------------------ */

function LinkItemRow({ item, onClick }: { item: LinkItemData; onClick?: () => void }) {
  const brand = getBrandByKey(item.brandKey);
  const localIconPath = getLocalIconPathByKey(item.brandKey);
  const hasSubView = item.id === 'instagram';

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-3 rounded-4xl hover:bg-muted/50 transition-colors group text-start w-full"
    >
      {/* Icon */}
      {localIconPath ? (
        <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-white dark:bg-zinc-900 border border-border/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={localIconPath} alt={item.name} width={20} height={20} className="w-5 h-5" />
        </div>
      ) : brand ? (
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
          style={{ backgroundColor: `#${brand.hex}` }}
        >
          <BrandIcon brand={brand} className="w-5 h-5 text-white" />
        </div>
      ) : item.id === 'website' ? (
        <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-indigo-500">
          <Globe className="w-5 h-5 text-white" />
        </div>
      ) : item.id === 'email' ? (
        <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-sky-500">
          <Mail className="w-5 h-5 text-white" />
        </div>
      ) : (
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
          style={{ backgroundColor: item.fallbackBg ?? '#6366f1' }}
        >
          <Link2 className="w-5 h-5 text-white" />
        </div>
      )}

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{item.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {item.description}
        </p>
      </div>

      {/* Arrow / indicator */}
      {hasSubView ? (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            خيارات
          </span>
          <ChevronLeft className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
        </div>
      ) : (
        <ChevronLeft className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
      )}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/*  AddLinkDialog                                                      */
/* ------------------------------------------------------------------ */

interface AddLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSuccess?: () => void;
}

export function AddLinkDialog({ open, onOpenChange, onAddSuccess }: AddLinkDialogProps) {
  const [activeCategory, setActiveCategory] = useState('suggested');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
      setActiveCategory('suggested');
      setSelectedPlatform(null);
    }
  }, [open]);

  // Clear platform sub-view when search is used
  useEffect(() => {
    if (searchQuery) setSelectedPlatform(null);
  }, [searchQuery]);

  /* ---- URL detection --------------------------------------------- */
  const isUrl = useMemo(() => {
    const q = searchQuery.trim();
    return /^https?:\/\//i.test(q) || /^[a-z0-9-]+\.[a-z]{2,}/i.test(q);
  }, [searchQuery]);

  const detectedPlatformKey = useMemo(() => {
    if (!isUrl) return null;
    return detectPlatformKeyFromUrl(searchQuery.trim());
  }, [isUrl, searchQuery]);

  const detectedBrand = useMemo(() => {
    if (!detectedPlatformKey) return null;
    return getBrandByKey(detectedPlatformKey);
  }, [detectedPlatformKey]);

  /* ---- Filtering ------------------------------------------------- */
  const filteredItems = useMemo(() => {
    return linkItems.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        activeCategory === 'all' || item.category.includes(activeCategory);

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl rounded-3xl sm:rounded-4xl p-0 gap-0 overflow-hidden h-[90vh] sm:h-[85vh] max-h-[90vh] sm:max-h-[85vh] flex flex-col"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 sm:px-5 pt-4 sm:pt-5 pb-2 sm:pb-3">
          <DialogTitle className="text-lg font-bold">
            {selectedPlatform === 'instagram' ? 'إضافة' : 'إضافة'}
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-center w-8 h-8 rounded-2xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Search (hidden when in sub-view) ── */}
        <AnimatePresence>
          {!selectedPlatform && (
            <motion.div
              key="search-bar"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden px-4 sm:px-5 pb-3 sm:pb-4"
            >
              <div className="flex items-center gap-3 h-11 px-4 rounded-xl bg-muted/60 border border-border/40 focus-within:border-foreground/20 focus-within:bg-muted transition-colors">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="الصق رابط أو ابحث..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Body: Sub-view or Main view ── */}
        <AnimatePresence mode="wait">
          {selectedPlatform === 'instagram' ? (
            <InstagramSubView
              key="instagram-sub"
              onBack={() => setSelectedPlatform(null)}
              onAddSuccess={() => {
                setSelectedPlatform(null);
                setSearchQuery('');
                onOpenChange(false);
                onAddSuccess?.();
              }}
            />
          ) : (
            <motion.div
              key="main-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex flex-col sm:flex-row min-h-0 flex-1 m-2 rounded-3xl border-t border-border/40 overflow-hidden"
            >
          {/* Mobile: horizontal scroll categories */}
          <nav className="sm:hidden shrink-0 border-b border-border/40 overflow-x-auto overscroll-x-contain [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-1 px-2 py-2 min-w-max">
              {categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap',
                      isActive
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground bg-muted/40'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Desktop: sidebar categories */}
          <nav className="hidden sm:block w-40 shrink-0 border-e border-border/40 py-2 overflow-y-auto overscroll-y-contain [&::-webkit-scrollbar]:hidden">
            <div className="flex flex-col gap-0.5 px-2">
              {categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-start',
                      isActive
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Content area */}
          <div className="flex-1 min-w-0 overflow-y-auto overscroll-y-contain [&::-webkit-scrollbar]:hidden py-3 sm:py-4 px-3 sm:px-4 pb-6">
            {/* URL auto-detection */}
            {isUrl && detectedPlatformKey && (
              <DetectedUrlCard
                platformKey={detectedPlatformKey}
                brand={detectedBrand}
                url={searchQuery.trim()}
                onAddSuccess={() => {
                  setSearchQuery('');
                  setActiveCategory('suggested');
                  onOpenChange(false);
                  onAddSuccess?.();
                }}
              />
            )}
            {isUrl && !detectedPlatformKey && (
              <UnknownUrlCard
                url={searchQuery.trim()}
                onAddSuccess={() => {
                  setSearchQuery('');
                  setActiveCategory('suggested');
                  onOpenChange(false);
                  onAddSuccess?.();
                }}
              />
            )}

            {/* Section title */}
            <p className="text-xs font-medium text-muted-foreground mb-3 px-1">
              {searchQuery
                ? `نتائج البحث (${filteredItems.length})`
                : categories.find((c) => c.id === activeCategory)?.label ?? ''}
            </p>

            {/* Link items list */}
            <div className="flex flex-col gap-1">
              <AnimatePresence mode="popLayout">
                {filteredItems.map((item) => (
                  <LinkItemRow
                    key={item.id}
                    item={item}
                    onClick={item.id === 'instagram' ? () => setSelectedPlatform('instagram') : undefined}
                  />
                ))}
              </AnimatePresence>

              {filteredItems.length === 0 && !isUrl && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Search className="w-8 h-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد نتائج</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    جرّب كلمة بحث مختلفة
                  </p>
                </div>
              )}
            </div>
          </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
