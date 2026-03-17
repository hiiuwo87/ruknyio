'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Calendar,
  Link2,
  ExternalLink,
  Users,
  ClipboardList,
  RefreshCw,
  Loader2,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/providers';
import { API_URL } from '@/lib/config';
import { usePhonePreview } from './phone-preview-context';
import { getBrandByKey, getLocalIconPathByKey } from '@/lib/brand-icons';
import {
  getInstagramBlocks,
  getInstagramMedia,
  getInstagramStatus,
  type InstagramBlock,
  type InstagramMedia,
} from '@/lib/api/instagram';

// Types
interface SocialLink {
  id: string;
  platform: string;
  url: string;
  title?: string;
  status?: 'active' | 'hidden';
  isFeatured?: boolean;
  displayOrder: number;
}

interface PublicProfile {
  id: string;
  username: string;
  name?: string;
  bio?: string;
  avatar?: string;
  coverImage?: string;
  banners?: string[];
  location?: string;
  visibility: string;
  createdAt: string;
  user: {
    id: string;
    name?: string;
  };
  socialLinks: SocialLink[];
  _count?: {
    followers: number;
    following: number;
  };
}

interface EventItem {
  id: string;
  title: string;
  startDate: string;
  location?: string;
  venue?: string;
}

interface PublicForm {
  id: string;
  title: string;
  description?: string;
  slug: string;
  type?: string;
  status?: string;
  expiresAt?: string;
  coverImage?: string;
  requiresAuthentication?: boolean;
  viewCount?: number;
  _count?: {
    submissions: number;
    fields: number;
  };
}

// Helper functions
const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

// Brand icon for preview
function PreviewLinkIcon({ platform, themeColor }: { platform: string; themeColor: string }) {
  const localPath = getLocalIconPathByKey(platform);
  const brand = getBrandByKey(platform);

  if (localPath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={localPath} alt={platform} className="w-3 h-3" />
    );
  }

  if (brand) {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-label={brand.title}
        className="w-3 h-3"
        style={{ color: themeColor }}
      >
        <path d={brand.path} />
      </svg>
    );
  }

  return <Link2 className="w-3 h-3" style={{ color: themeColor }} />;
}

interface PhonePreviewProps {
  className?: string;
}

export function PhonePreview({ className }: PhonePreviewProps) {
  const { user } = useAuth();
  const { profile, setProfile } = usePhonePreview();
  const [loading, setLoading] = useState(!profile);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [activeTab, setActiveTab] = useState<'links' | 'events' | 'forms'>('links');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [forms, setForms] = useState<PublicForm[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [igBlocks, setIgBlocks] = useState<InstagramBlock[]>([]);
  const [igMedia, setIgMedia] = useState<InstagramMedia[]>([]);

  const themeColor = '#0D9488';

  // Fetch profile data (إذا لم يوجد profile نعتمد على user من useAuth للاسم والصورة)
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/profiles/me`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        } else {
          setProfile(null);
        }
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if profile not already set (to avoid double fetching)
    if (!profile) {
      fetchProfile();
    }
  }, [user?.id, profile, setProfile]);

  // Auto-slide banners
  useEffect(() => {
    if (!profile?.banners || profile.banners.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev === profile.banners!.length - 1 ? 0 : prev + 1));
    }, 5000);
    
    return () => clearInterval(interval);
  }, [profile?.banners]);

  const handleRefresh = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/profiles/me`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Fetch events/forms for preview
  useEffect(() => {
    const username = profile?.username || user?.username;
    if (!username) {
      setEvents([]);
      setForms([]);
      return;
    }

    const controller = new AbortController();

    const fetchContent = async () => {
      try {
        setContentLoading(true);
        const [eventsRes, formsRes] = await Promise.all([
          fetch(`${API_URL}/events?organizerUsername=${encodeURIComponent(username)}&limit=5`, {
            credentials: 'include', signal: controller.signal,
          }),
          fetch(`${API_URL}/forms/public/user/${encodeURIComponent(username)}?limit=10`, {
            credentials: 'include', signal: controller.signal,
          }),
        ]);

        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          setEvents(eventsData?.events || []);
        } else {
          setEvents([]);
        }

        if (formsRes.ok) {
          const formsData = await formsRes.json();
          setForms(formsData?.forms || []);
        } else {
          setForms([]);
        }

        // Fetch Instagram blocks + media (only if connected)
        try {
          const status = await getInstagramStatus();
          if (status.connected) {
            const [blocks, mediaResult] = await Promise.all([
              getInstagramBlocks(),
              getInstagramMedia(9),
            ]);
            setIgBlocks(blocks.filter((b) => b.isActive));
            setIgMedia(mediaResult.data || []);
          } else {
            setIgBlocks([]);
            setIgMedia([]);
          }
        } catch {
          setIgBlocks([]);
          setIgMedia([]);
        }
      } catch {
        if (!controller.signal.aborted) {
          setEvents([]);
          setForms([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setContentLoading(false);
        }
      }
    };

    fetchContent();

    return () => controller.abort();
  }, [profile?.username, user?.username]);

  // اسم وعرض من Profile أو من بيانات الحساب (auth) كاحتياطي
  const displayName = profile?.name || profile?.user?.name || user?.name || profile?.username || user?.username || (user?.email ? user.email.split('@')[0] : null) || 'المستخدم';
  const displayUsername = profile?.username || user?.username || '';
  const displayAvatar = profile?.avatar ?? user?.avatar;
  const profileUrl = typeof window !== 'undefined' && (profile?.username || user?.username)
    ? `${window.location.origin}/${profile?.username || user?.username}` 
    : '';

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* Phone Frame */}
      <div className="relative w-[280px] h-[560px] bg-white rounded-[2rem] overflow-hidden shadow-xl border border-gray-200">
        {/* Screen Content */}
        <div className="absolute inset-0 bg-white overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <span className="text-xs text-gray-400">جاري التحميل...</span>
            </div>
          ) : !profile && !user?.id ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
              <Users className="w-10 h-10 text-gray-300" />
              <span className="text-xs text-gray-400">سجّل الدخول لعرض المعاينة</span>
            </div>
          ) : (
            <div className="pb-6">
              {/* Cover Image (فقط عند وجود profile مع صورة غلاف) */}
              {profile?.coverImage && (
                <div className="relative h-24 overflow-hidden">
                  <img 
                    src={profile.coverImage} 
                    alt="Cover"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
              )}

              {/* Hero Section: الاسم والصورة من profile أو من user (الحساب) */}
              <div className={cn("px-4 py-4", profile?.coverImage && "-mt-8")}>
                <div className="flex flex-col items-center text-center">
                  <Avatar className={cn(
                    "w-16 h-16 ring-4 ring-white",
                    profile?.coverImage && "ring-2"
                  )}>
                    {displayAvatar && (
                      <AvatarImage 
                        src={displayAvatar} 
                        alt={displayName}
                      />
                    )}
                    <AvatarFallback 
                      className="text-sm font-bold text-white"
                      style={{ backgroundColor: themeColor }}
                    >
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>

                  <h1 className="mt-2 text-sm font-bold text-gray-900">{displayName}</h1>
                  {displayUsername && <p className="text-[10px] text-gray-500">@{displayUsername}</p>}

                  {/* Bio (فقط عند وجود profile) */}
                  {profile?.bio && (
                    <p className="mt-2 text-[10px] text-gray-600 line-clamp-2 px-2">
                      {profile.bio}
                    </p>
                  )}

                  {/* Meta (فقط عند وجود profile) */}
                  {profile && (
                  <div className="flex items-center gap-3 mt-2 text-[9px] text-gray-400">
                    {profile.location && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" />
                        {profile.location}
                      </span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-2.5 h-2.5" />
                      {new Date(profile.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  )}
                </div>

                {/* رسالة عند عدم وجود profile: استخدم بيانات الحساب فقط */}
                {!profile && user?.id && (
                  <p className="mt-2 text-[10px] text-gray-500 text-center px-2">أكمل الملف الشخصي لإظهار الرابط والغلاف والمزيد</p>
                )}

                {/* Stats (فقط عند وجود profile) */}
                {profile && (
                <div className="flex items-center justify-center gap-6 mt-3 py-2 border-y border-gray-100">
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900">{formatNumber(profile._count?.followers || 0)}</p>
                    <p className="text-[8px] text-gray-500">متابع</p>
                  </div>
                  <div className="h-6 w-px bg-gray-200" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900">{formatNumber(profile._count?.following || 0)}</p>
                    <p className="text-[8px] text-gray-500">يتابع</p>
                  </div>
                </div>
                )}

                {/* Banners (فقط عند وجود profile) */}
                {profile?.banners && profile.banners.length > 0 && (
                  <div className="mt-3">
                    <div className="rounded-xl overflow-hidden relative h-20">
                      <AnimatePresence mode="wait">
                        <motion.img
                          key={currentBanner}
                          src={profile.banners[currentBanner]}
                          alt={`Banner ${currentBanner + 1}`}
                          className="w-full h-full object-cover absolute inset-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25 }}
                        />
                      </AnimatePresence>
                      
                      {profile.banners.length > 1 && (
                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1">
                          {profile.banners.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCurrentBanner(idx)}
                              className={cn(
                                "rounded-full transition-all",
                                idx === currentBanner
                                  ? "bg-white w-3 h-1"
                                  : "bg-white/50 w-1 h-1"
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tabs و الروابط */}
                {(profile || user?.id) && (
                <>
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <button
                    onClick={() => setActiveTab('links')}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[9px] font-medium transition-all",
                      activeTab === 'links'
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600"
                    )}
                  >
                    الروابط
                  </button>
                  <button
                    onClick={() => setActiveTab('events')}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[9px] font-medium transition-all",
                      activeTab === 'events'
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600"
                    )}
                  >
                    الأحداث
                  </button>
                  <button
                    onClick={() => setActiveTab('forms')}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[9px] font-medium transition-all",
                      activeTab === 'forms'
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600"
                    )}
                  >
                    النماذج
                  </button>
                </div>

                {/* Links */}
                <div className="mt-3 space-y-2">
                  {activeTab === 'links' && profile?.socialLinks?.filter(link => link.status !== 'hidden')?.map((link) => {
                    return (
                      <div
                        key={link.id}
                        className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: `${themeColor}15` }}
                          >
                            <PreviewLinkIcon platform={link.platform?.toLowerCase() ?? ''} themeColor={themeColor} />
                          </div>
                          <span className="text-[10px] font-medium text-gray-900">{link.title || link.platform}</span>
                        </div>
                        <ExternalLink className="w-2.5 h-2.5 text-gray-400" />
                      </div>
                    );
                  })}
                  
                  {activeTab === 'links' && (!profile?.socialLinks || profile.socialLinks.length === 0) && igBlocks.length === 0 && (
                    <div className="text-center py-6 text-gray-400">
                      <Link2 className="w-6 h-6 mx-auto mb-1" />
                      <p className="text-[9px]">لا توجد روابط</p>
                    </div>
                  )}

                  {/* Instagram Blocks in links tab */}
                  {activeTab === 'links' && igBlocks.map((block) => {
                    const isGrid = block.type === 'GRID';
                    const items = isGrid ? igMedia.slice(0, 9) : igMedia.slice(0, 6);
                    if (items.length === 0) return null;

                    return (
                      <div key={block.id} className="rounded-lg border border-gray-100 overflow-hidden">
                        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/icons/instagram.svg" alt="Instagram" className="w-3 h-3" />
                          <span className="text-[9px] font-semibold text-gray-700">
                            {isGrid ? 'شبكة إنستغرام' : 'أحدث المنشورات'}
                          </span>
                        </div>
                        <div className="p-1.5">
                          {isGrid ? (
                            <div className="grid grid-cols-3 gap-0.5">
                              {items.map((m) => (
                                <div key={m.id} className="relative aspect-square rounded overflow-hidden">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={m.thumbnail_url || m.media_url} alt="" className="w-full h-full object-cover" />
                                  {block.gridLinks.find((gl) => gl.mediaId === m.id)?.linkUrl && (
                                    <div className="absolute top-0.5 right-0.5 w-3 h-3 bg-emerald-500 rounded-full flex items-center justify-center">
                                      <Link2 className="w-1.5 h-1.5 text-white" />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                              {items.map((m) => (
                                <div key={m.id} className="shrink-0 w-16 rounded overflow-hidden border border-gray-50">
                                  <div className="aspect-square">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={m.thumbnail_url || m.media_url} alt="" className="w-full h-full object-cover" />
                                  </div>
                                  <p className="text-[7px] text-gray-400 p-1 line-clamp-1">{m.caption || 'بدون وصف'}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {activeTab === 'events' && (
                    <>
                      {contentLoading ? (
                        <div className="text-center py-6 text-gray-400">
                          <Loader2 className="w-5 h-5 mx-auto mb-1 animate-spin" />
                          <p className="text-[9px]">جاري التحميل...</p>
                        </div>
                      ) : events.length > 0 ? (
                        events.map((event) => (
                          <div
                            key={event.id}
                            className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-100"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-6 h-6 rounded-md flex items-center justify-center"
                                style={{ backgroundColor: `${themeColor}15` }}
                              >
                                <Calendar className="w-3 h-3" style={{ color: themeColor }} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-medium text-gray-900 truncate">
                                  {event.title}
                                </p>
                                <p className="text-[9px] text-gray-400">
                                  {new Date(event.startDate).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-gray-400">
                          <Calendar className="w-6 h-6 mx-auto mb-1" />
                          <p className="text-[9px]">لا توجد أحداث</p>
                        </div>
                      )}
                    </>
                  )}

                  {activeTab === 'forms' && (
                    <>
                      {contentLoading ? (
                        <div className="text-center py-6 text-gray-400">
                          <Loader2 className="w-5 h-5 mx-auto mb-1 animate-spin" />
                          <p className="text-[9px]">جاري التحميل...</p>
                        </div>
                      ) : forms.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {forms.map((form) => {
                            const submissionsCount = form._count?.submissions || 0;
                            const fieldsCount = form._count?.fields || 0;
                            const formCoverUrl = form.coverImage || null;
                            
                            return (
                              <div
                                key={form.id}
                                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                              >
                                {/* Cover Image */}
                                <div className="relative h-20 bg-gradient-to-br from-violet-50 to-purple-50">
                                  {formCoverUrl ? (
                                    <img
                                      src={formCoverUrl}
                                      alt={form.title}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <div className="w-10 h-10 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center">
                                        <ClipboardList className="w-5 h-5 text-violet-500" />
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Status Badge - Top Right */}
                                  {form.status && (
                                    <span className={cn(
                                      "absolute top-1 right-1 px-1.5 py-0.5 text-[8px] font-bold rounded-md",
                                      form.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-600' :
                                      form.status === 'DRAFT' ? 'bg-amber-100 text-amber-600' :
                                      'bg-gray-100 text-gray-600'
                                    )}>
                                      {form.status === 'PUBLISHED' ? 'منشور' : 
                                       form.status === 'DRAFT' ? 'مسودة' : 'مؤرشف'}
                                    </span>
                                  )}
                                  
                                  {/* Responses Badge - Top Left */}
                                  {submissionsCount > 0 && (
                                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-violet-500 text-white flex items-center gap-0.5">
                                      <Users className="w-2.5 h-2.5" />
                                      {submissionsCount}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Content */}
                                <div className="p-2">
                                  {/* Title & Type */}
                                  <div className="flex items-start justify-between gap-1 mb-1.5">
                                    <h4 className="text-[10px] font-bold text-gray-900 line-clamp-1 flex-1">
                                      {form.title}
                                    </h4>
                                    {form.type && (
                                      <span className="px-1.5 py-0.5 text-[8px] font-bold bg-gray-100 text-gray-700 rounded-md whitespace-nowrap">
                                        {form.type === 'SURVEY' ? 'استبيان' : 
                                         form.type === 'REGISTRATION' ? 'تسجيل' : 
                                         form.type === 'FEEDBACK' ? 'تقييم' :
                                         form.type === 'CONTACT' ? 'اتصال' :
                                         form.type === 'ORDER' ? 'طلب' :
                                         form.type === 'QUIZ' ? 'اختبار' :
                                         form.type === 'APPLICATION' ? 'طلب توظيف' : 'نموذج'}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Description */}
                                  {form.description && (
                                    <p className="text-[8px] text-gray-400 line-clamp-2 leading-relaxed">
                                      {form.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-400">
                          <ClipboardList className="w-6 h-6 mx-auto mb-1" />
                          <p className="text-[9px]">لا توجد نماذج</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
                </>
                )}

                {/* Footer */}
                <div className="mt-4 text-center">
                  <p className="text-[8px] text-gray-300">
                    مدعوم من <span className="font-semibold text-gray-400">Rukny</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          تحديث
        </button>
        {(profile?.username || displayUsername) && (
          <a
            href={profileUrl || `/${displayUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            فتح الصفحة
          </a>
        )}
      </div>
    </div>
  );
}

export default PhonePreview;
