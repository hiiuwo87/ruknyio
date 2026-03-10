'use client';

import { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Shield,
  ShieldCheck,
  Smartphone,
  History,
  GitMerge,
  Bell,
  Cloud,
  Store,
  Package,
  ShoppingCart,
  FileText,
  FileEdit,
  Layers,
  Inbox,
  Calendar,
  Ticket,
  CalendarDays,
  ChevronLeft,
  Settings,
  Menu,
  X,
  Globe,
  MonitorSmartphone,
  BadgeCheck,
  Truck,
  Zap,
  Megaphone,
  Sparkles,
  Lock,
  Mail,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers';
import Image from 'next/image';

function WhatsAppIcon({ className }: { className?: string }) {
  return <Image src="/icons/whatsapp.svg" alt="" width={16} height={16} className={className} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// Types & Data
// ═══════════════════════════════════════════════════════════════════════════

export interface SettingsSection {
  id: string;
  label: string;
  icon: React.ElementType;
  items: {
    href: string;
    label: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

export const settingsSections: SettingsSection[] = [
  {
    id: 'store',
    label: 'إدارة المتجر',
    icon: Store,
    items: [
      { href: '/app/settings/store', label: 'إعدادات المتجر', icon: Store },
      { href: '/app/settings/store/integrations', label: 'التكاملات', icon: GitMerge },
      { href: '/app/settings/store/delivery', label: 'التوصيل', icon: Truck },
      { href: '/app/settings/store/automation', label: 'الأتمتة', icon: Zap },
      { href: '/app/settings/store/marketing', label: 'التسويق', icon: Megaphone },
      { href: '/app/settings/store/ai', label: 'الذكاء الاصطناعي', icon: Sparkles },
    ],
  },
  {
    id: 'forms',
    label: 'إدارة النماذج',
    icon: FileText,
    items: [
      { href: '/app/settings?tab=forms-general', label: 'إعدادات النماذج', icon: FileEdit },
      { href: '/app/settings?tab=templates', label: 'قوالب النماذج', icon: Layers },
      { href: '/app/settings?tab=submissions', label: 'الإرساليات', icon: Inbox },
    ],
  },
  {
    id: 'events',
    label: 'إدارة الأحداث',
    icon: Calendar,
    items: [
      { href: '/app/settings?tab=events-general', label: 'إعدادات الأحداث', icon: Calendar },
      { href: '/app/settings?tab=tickets', label: 'التذاكر', icon: Ticket },
      { href: '/app/settings?tab=calendar', label: 'التقويم', icon: CalendarDays },
    ],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Business',
    icon: WhatsAppIcon,
    items: [
      { href: '/app/settings/whatsapp', label: 'إدارة عامة', icon: Settings },
      { href: '/app/settings/whatsapp/account', label: 'الحساب', icon: User },
      { href: '/app/settings/whatsapp/templates', label: 'قوالب', icon: FileText },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Sidebar Content
// ═══════════════════════════════════════════════════════════════════════════

function SettingsSidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [openSection, setOpenSection] = useState<string | null>('profile');

  const toggleSection = useCallback((sectionId: string) => {
    setOpenSection((prev) => (prev === sectionId ? null : sectionId));
  }, []);

  const isItemActive = (href: string) => {
    if (href.includes('?tab=')) {
      const tab = href.split('?tab=')[1]?.split('&')[0];
      return pathname === '/app/settings' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === tab;
    }
    return pathname === href;
  };

  return (
    <>
      {/* Brand Header - متطابق مع Dashboard */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <div className="relative size-10 shrink-0 overflow-hidden rounded-4xl bg-gradient-to-br from-primary to-primary/70 shadow-sm shadow-primary/20 ring-1 ring-primary/10">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name || ''}
              className="size-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center text-sm font-bold text-primary-foreground',
              user?.avatar && 'hidden'
            )}
          >
            {(user?.name || 'إ').charAt(0)}
          </span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="truncate text-[13px] font-semibold text-foreground leading-tight">الإعدادات</span>
          <span className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">{user?.name || 'حسابك'}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-5 py-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">الإعدادات</p>
        <div className="space-y-0.5 w-full">
          {/* Back to Dashboard Link */}
          <Link
            href="/app"
            onClick={onItemClick}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <MonitorSmartphone className="size-4 text-muted-foreground" />
            <span>الرجوع إلى لوحة التحكم</span>
          </Link>

          {/* Direct Profile Link */}
          <Link
            href="/app/settings/profile"
            onClick={onItemClick}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
              isItemActive('/app/settings/profile')
                ? 'bg-primary/5 font-semibold text-foreground'
                : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
            )}
          >
            <User className={cn('size-4', isItemActive('/app/settings/profile') ? 'text-primary' : 'text-muted-foreground')} />
            <span>الملف الشخصي</span>
          </Link>

          {/* Direct Account Link */}
          <Link
            href="/app/settings/account"
            onClick={onItemClick}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
              isItemActive('/app/settings/account')
                ? 'bg-primary/5 font-semibold text-foreground'
                : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
            )}
          >
            <Settings className={cn('size-4', isItemActive('/app/settings/account') ? 'text-primary' : 'text-muted-foreground')} />
            <span>إدارة الحساب</span>
          </Link>

          {/* Direct Integrations Link */}
          <Link
            href="/app/settings/integrations"
            onClick={onItemClick}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
              isItemActive('/app/settings/integrations')
                ? 'bg-primary/5 font-semibold text-foreground'
                : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
            )}
          >
            <GitMerge className={cn('size-4', isItemActive('/app/settings/integrations') ? 'text-primary' : 'text-muted-foreground')} />
            <span>التكاملات</span>
          </Link>

          {settingsSections.map((section) => {
            const isOpen = openSection === section.id;
            const SectionIcon = section.icon;
            const hasActiveItem = section.items.some((i) => isItemActive(i.href));

            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] transition-colors',
                    hasActiveItem || isOpen
                      ? 'bg-primary/5 font-semibold text-foreground'
                      : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <SectionIcon className={cn('size-4', hasActiveItem ? 'text-primary' : 'text-muted-foreground')} />
                    <span>{section.label}</span>
                  </div>
                  <ChevronLeft
                    className={cn(
                      'size-3.5 transition-transform duration-200',
                      isOpen ? 'text-primary -rotate-90' : 'text-muted-foreground/60'
                    )}
                    aria-hidden
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="overflow-hidden"
                    >
                      <div className="mr-3 border-r border-primary/20 space-y-0.5 py-1">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = isItemActive(item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={onItemClick}
                              className={cn(
                                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] transition-colors',
                                isActive
                                  ? 'bg-primary/10 font-semibold text-primary'
                                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                              )}
                            >
                              <Icon className="size-3.5 shrink-0" />
                              <span className="truncate flex-1">{item.label}</span>
                              {item.badge && (
                                <span className={cn(
                                  'px-1.5 py-0.5 text-[9px] font-bold rounded-full shrink-0',
                                  isActive
                                    ? 'bg-primary-foreground/20 text-primary-foreground'
                                    : item.badge === 'جديد'
                                      ? 'bg-success/12 text-success'
                                      : 'bg-primary/10 text-primary'
                                )}>
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Divider */}
      <div className="px-5 pb-1">
        <div className="mb-2 h-px w-full bg-gradient-to-l from-transparent via-border to-transparent" />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Desktop Sidebar
// ═══════════════════════════════════════════════════════════════════════════

export function SettingsSidebarDesktop() {
  return (
    <aside className="relative flex h-screen w-[240px] flex-col bg-background shrink-0" dir="rtl">
      {/* Gradient divider */}
      <div className="via-border absolute left-0 top-12 bottom-0 w-px bg-gradient-to-b from-transparent to-transparent" />
      <SettingsSidebarContent />
    </aside>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Mobile Sidebar Slider
// ═══════════════════════════════════════════════════════════════════════════

export function SettingsSidebarSlider() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle button */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-card border border-border/30 shadow-sm lg:hidden"
        aria-label="فتح قائمة الإعدادات"
      >
        <Menu className="size-5 text-foreground" />
      </button>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              onClick={() => setIsMobileOpen(false)}
            />
            <motion.div
              initial={{ x: 280 }}
              animate={{ x: 0 }}
              exit={{ x: 280 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="fixed top-0 right-0 z-50 h-screen lg:hidden"
            >
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="absolute top-4 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
                aria-label="إغلاق القائمة"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
              <aside className="relative flex h-screen w-[240px] flex-col bg-background shrink-0" dir="rtl">
                <SettingsSidebarContent onItemClick={() => setIsMobileOpen(false)} />
              </aside>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export function SettingsSidebar() {
  return <SettingsSidebarDesktop />;
}
