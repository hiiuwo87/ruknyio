'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard,
  Link2,
  ShoppingBag,
  FileText,
  CalendarDays,
  BarChart3,
  Plus,
  Package,
  CalendarPlus,
  ListPlus,
  LinkIcon,
  Settings,
  Truck,
  PackageSearch,
  Receipt,
  TrendingUp,
  BadgeCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Dock, DockIcon } from '@/components/ui/dock';
import { useAuth } from '@/providers';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types & Data                                                       */
/* ------------------------------------------------------------------ */

interface DockNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface QuickAction {
  href: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

interface ActionSection {
  title: string;
  items: QuickAction[];
}

const navItems: DockNavItem[] = [
  { href: '/app', label: 'الرئيسية', icon: LayoutDashboard },
  { href: '/app/links', label: 'روابطي', icon: Link2 },
  { href: '/app/store', label: 'المتجر', icon: ShoppingBag },
  { href: '/app/forms', label: 'النماذج', icon: FileText },
  { href: '/app/events', label: 'الأحداث', icon: CalendarDays },
  { href: '/app/analytics', label: 'الإحصائيات', icon: BarChart3 },
];

const actionSections: ActionSection[] = [
  {
    title: 'إنشاء سريع',
    items: [
      { href: '/app/store/products/create', label: 'منتج جديد', icon: Package, color: 'bg-orange-500' },
      { href: '/app/forms/create?new=true', label: 'نموذج جديد', icon: FileText, color: 'bg-blue-500' },
      { href: '/app/events/create', label: 'حدث جديد', icon: CalendarPlus, color: 'bg-purple-500' },
      { href: '/app/tasks/create', label: 'مهمة جديدة', icon: ListPlus, color: 'bg-emerald-500' },
      { href: '/app/links', label: 'إضافة رابط', icon: LinkIcon, color: 'bg-pink-500' },
    ],
  },
  {
    title: 'المتجر والمبيعات',
    items: [
      { href: '/app/store/orders', label: 'تتبع الطلبات', icon: PackageSearch, color: 'bg-sky-500' },
      { href: '/app/settings/store/delivery', label: 'شركات التوصيل', icon: Truck, color: 'bg-amber-500' },
      { href: '/app/store/invoices', label: 'الفواتير', icon: Receipt, color: 'bg-teal-500' },
      { href: '/app/analytics', label: 'المبيعات والأرباح', icon: TrendingUp, color: 'bg-indigo-500' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MobileDock() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const toggleMenu = useCallback(() => setIsOpen((v) => !v), []);
  const closeMenu = useCallback(() => setIsOpen(false), []);

  const isActive = (href: string) => {
    const path = href.split('?')[0];
    if (path === '/app') return pathname === '/app';
    return pathname === path || pathname.startsWith(path + '/');
  };

  const showAvatar = user?.avatar && !avatarError;
  const initials = (user?.name || 'ر').charAt(0);

  return (
    <>
      {/* Quick Actions Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              onClick={closeMenu}
            />
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed inset-x-3 z-50 max-h-[72vh] lg:hidden"
              style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
              dir="rtl"
            >
              <div className="overflow-y-auto rounded-3xl border border-border/60 bg-background/95 shadow-2xl shadow-black/10 ring-1 ring-black/5 backdrop-blur-xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

                {/* Profile Header */}
                <Link
                  href="/app/settings/profile"
                  onClick={closeMenu}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/40 active:bg-muted/60"
                >
                  <div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary/70 ring-2 ring-primary/20">
                    {showAvatar ? (
                      <img
                        src={user!.avatar!}
                        alt={user?.name || ''}
                        className="size-full object-cover"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-sm font-bold text-primary-foreground">
                        {initials}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {user?.name || 'المستخدم'}
                      </span>
                      {user?.emailVerified && (
                        <BadgeCheck className="size-3.5 shrink-0 text-primary fill-primary/20" />
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {user?.email || ''}
                    </p>
                  </div>
                </Link>

                <div className="mx-4 h-px bg-border/30" />

                {/* Action Sections */}
                {actionSections.map((section, si) => (
                  <div key={section.title} className="py-2.5">
                    <p className="mb-1.5 px-5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                      {section.title}
                    </p>
                    {section.items.map((action, i) => (
                      <motion.div
                        key={action.href + action.label}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: si * 0.05 + i * 0.03, duration: 0.15 }}
                      >
                        <Link
                          href={action.href}
                          onClick={closeMenu}
                          className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-foreground/80 transition-colors hover:bg-muted/40 active:bg-muted/70"
                        >
                          <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm', action.color)}>
                            <action.icon className="size-4" />
                          </span>
                          <span className="text-sm font-medium">{action.label}</span>
                        </Link>
                      </motion.div>
                    ))}
                    {si < actionSections.length - 1 && (
                      <div className="mx-4 mt-2 h-px bg-border/30" />
                    )}
                  </div>
                ))}

                <div className="mx-4 h-px bg-border/30" />

                {/* Settings */}
                <Link
                  href="/app/settings"
                  onClick={closeMenu}
                  className="sticky bottom-0 flex items-center gap-3 bg-background/95 px-4 py-3 text-foreground/70 backdrop-blur transition-colors hover:bg-muted/40 active:bg-muted/60"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Settings className="size-4" />
                  </span>
                  <span className="text-sm font-medium">الإعدادات</span>
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Dock */}
      <div
        className="fixed left-0 right-0 z-50 flex justify-center lg:hidden"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <Dock
          direction="middle"
          magnification={52}
          distance={92}
          className="mx-auto mt-0 h-[60px] gap-1.5 rounded-2xl border-border/60 bg-background/85 px-2.5 shadow-xl shadow-black/10 backdrop-blur-xl"
        >
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <DockIcon key={item.href} size={42} className={cn(
                'transition-colors',
                active
                  ? 'bg-primary/12 ring-1 ring-primary/20'
                  : 'hover:bg-muted/60'
              )}>
                <Link
                  href={item.href}
                  className="flex size-full flex-col items-center justify-center"
                  aria-label={item.label}
                >
                  <item.icon
                    className={cn(
                      'size-5',
                      active ? 'text-primary' : 'text-muted-foreground',
                    )}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                </Link>
              </DockIcon>
            );
          })}

          {/* + Button */}
          <DockIcon size={42} className="bg-primary shadow-sm hover:bg-primary/90 transition-colors">
            <button
              type="button"
              onClick={toggleMenu}
              className="flex size-full items-center justify-center"
              aria-label={isOpen ? 'إغلاق القائمة' : 'إنشاء سريع'}
            >
              <motion.div
                animate={{ rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <Plus className="size-[22px] text-primary-foreground" strokeWidth={2.5} />
              </motion.div>
            </button>
          </DockIcon>
        </Dock>
      </div>
    </>
  );
}