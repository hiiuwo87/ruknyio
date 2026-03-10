'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, 
  Calendar, 
  Link2, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Users,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/providers';

// API helpers
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';
const buildApiPath = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  return `${base}${path}`;
};
const secureFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { credentials: 'include', ...opts });

const resolveAvatarUrl = (avatar?: string | null): string | null => {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('users/') || avatar.startsWith('profiles/')) {
    return `${API_BASE_URL}/api/${avatar}`;
  }
  const filename = avatar.split('/').pop() || avatar;
  return `${API_BASE_URL}/uploads/avatars/${filename}`;
};

const resolveCoverUrl = (cover?: string | null): string | null => {
  if (!cover) return null;
  if (cover.startsWith('http')) return cover;
  if (cover.startsWith('users/') || cover.startsWith('profiles/') || cover.startsWith('covers/')) {
    return `${API_BASE_URL}/api/${cover}`;
  }
  const filename = cover.split('/').pop() || cover;
  return `${API_BASE_URL}/uploads/covers/${filename}`;
};

const resolveFormCoverUrl = (cover?: string | null): string | null => {
  if (!cover) return null;
  if (cover.startsWith('http')) return cover;
  if (cover.startsWith('forms/')) {
    return `${API_BASE_URL}/api/${cover}`;
  }
  const filename = cover.split('/').pop() || cover;
  return `${API_BASE_URL}/uploads/forms/${filename}`;
};

// Types
interface SocialLink {
  id: string;
  platform: string;
  url: string;
  title?: string;
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

// Social Icons Map (simplified)
const socialIcons: Record<string, any> = {
  instagram: Link2,
  twitter: Link2,
  x: Link2,
  linkedin: Link2,
  youtube: Link2,
  github: Link2,
  website: Link2,
  custom: Link2,
};

interface PhonePreviewProps {
  className?: string;
}

export function PhonePreview({ className }: PhonePreviewProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [activeTab, setActiveTab] = useState<'links' | 'events' | 'forms'>('links');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [forms, setForms] = useState<PublicForm[]>([]);
  const [contentLoading, setContentLoading] = useState(false);

  const themeColor = '#0D9488';
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

  // Fetch profile data (إذا لم يوجد profile نعتمد على user من useAuth للاسم والصورة)
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        const response = await secureFetch(buildApiPath('/profiles/me'));
        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        } else {
          setProfile(null);
        }
      } catch (error) {
        // Error fetching profile
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

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
      const response = await secureFetch(buildApiPath('/profiles/me'));
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      // Error refreshing profile
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
            signal: controller.signal,
          }),
          fetch(`${API_URL}/forms/public/user/${encodeURIComponent(username)}?limit=10`, {
            signal: controller.signal,
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
      } catch (error) {
        if (!controller.signal.aborted) {
          // Error fetching preview content
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
  }, [API_URL, profile?.username, user?.username]);

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
                    src={resolveCoverUrl(profile.coverImage) || undefined} 
                    alt="Cover"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).parentElement!.style.display = 'none';
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
                        src={resolveAvatarUrl(displayAvatar) || undefined} 
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

                  <div className="mt-2 flex items-center gap-1">
                    <h1 className="text-sm font-bold text-gray-900">{displayName}</h1>
                    {profile?.visibility === 'PUBLIC' && (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 22 22" fill="none">
                        <path 
                          d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681.132-.637.075-1.299-.165-1.903.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246-5.683 6.206z" 
                          fill="#1D9BF0"
                        />
                      </svg>
                    )}
                  </div>
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
                  {activeTab === 'links' && profile?.socialLinks?.map((link) => {
                    const Icon = socialIcons[link.platform?.toLowerCase()] || Link2;
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
                            <Icon className="w-3 h-3" style={{ color: themeColor }} />
                          </div>
                          <span className="text-[10px] font-medium text-gray-900">{link.title || link.platform}</span>
                        </div>
                        <ExternalLink className="w-2.5 h-2.5 text-gray-400" />
                      </div>
                    );
                  })}
                  
                  {activeTab === 'links' && (!profile?.socialLinks || profile.socialLinks.length === 0) && (
                    <div className="text-center py-6 text-gray-400">
                      <Link2 className="w-6 h-6 mx-auto mb-1" />
                      <p className="text-[9px]">لا توجد روابط</p>
                    </div>
                  )}

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
                            const formCoverUrl = resolveFormCoverUrl(form.coverImage);
                            
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
