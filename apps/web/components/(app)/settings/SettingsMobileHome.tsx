'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Settings,
  GitMerge,
  Store,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronDown,
  ArrowRight,
  FileEdit,
  Layers,
  Inbox,
  Ticket,
  CalendarDays,
  Truck,
  Zap,
  Megaphone,
  Sparkles,
  MonitorSmartphone,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers';

import Image from 'next/image';

function WhatsAppIcon({ className }: { className?: string }) {
  return <Image src="/icons/whatsapp.svg" alt="" width={16} height={16} className={className} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface DirectSettingsItem {
  type: 'direct';
  href: string;
  label: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

interface ExpandableSettingsItem {
  type: 'expandable';
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  items: {
    href: string;
    label: string;
    icon: React.ElementType;
  }[];
}

type SettingsItem = DirectSettingsItem | ExpandableSettingsItem;

// ═══════════════════════════════════════════════════════════════════════════
// Data
// ═══════════════════════════════════════════════════════════════════════════

const settingsItems: SettingsItem[] = [
  {
    type: 'direct',
    href: '/app/settings/profile',
    label: 'الملف الشخصي',
    description: 'الاسم، الصورة، البيانات الشخصية',
    icon: User,
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
  },
  {
    type: 'direct',
    href: '/app/settings/account',
    label: 'إدارة الحساب',
    description: 'البريد، كلمة المرور، الأمان',
    icon: Settings,
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-500',
  },
  {
    type: 'direct',
    href: '/app/settings/integrations',
    label: 'التكاملات',
    description: 'ربط التطبيقات والخدمات الخارجية',
    icon: GitMerge,
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-500',
  },
  {
    type: 'expandable',
    id: 'store',
    label: 'إدارة المتجر',
    description: 'إعدادات المتجر، التوصيل، الأتمتة، التسويق',
    icon: Store,
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-500',
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
    type: 'expandable',
    id: 'forms',
    label: 'إدارة النماذج',
    description: 'القوالب، الإرساليات، إعدادات النماذج',
    icon: FileText,
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-500',
    items: [
      { href: '/app/settings?tab=forms-general', label: 'إعدادات النماذج', icon: FileEdit },
      { href: '/app/settings?tab=templates', label: 'قوالب النماذج', icon: Layers },
      { href: '/app/settings?tab=submissions', label: 'الإرساليات', icon: Inbox },
    ],
  },
  {
    type: 'expandable',
    id: 'events',
    label: 'إدارة الأحداث',
    description: 'التذاكر، التقويم، إعدادات الأحداث',
    icon: Calendar,
    iconBg: 'bg-cyan-500/10',
    iconColor: 'text-cyan-500',
    items: [
      { href: '/app/settings?tab=events-general', label: 'إعدادات الأحداث', icon: Calendar },
      { href: '/app/settings?tab=tickets', label: 'التذاكر', icon: Ticket },
      { href: '/app/settings?tab=calendar', label: 'التقويم', icon: CalendarDays },
    ],
  },
  {
    type: 'expandable',
    id: 'whatsapp',
    label: 'WhatsApp Business',
    description: 'إدارة حساب واتساب، القوالب، الإعدادات',
    icon: WhatsAppIcon,
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-500',
    items: [
      { href: '/app/settings/whatsapp', label: 'إدارة عامة', icon: Settings },
      { href: '/app/settings/whatsapp/account', label: 'الحساب', icon: User },
      { href: '/app/settings/whatsapp/templates', label: 'قوالب', icon: FileText },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export function SettingsMobileHome() {
  const { user } = useAuth();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = useCallback((id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="min-h-screen bg-background pb-8" dir="rtl">
      {/* User Card */}
      <div className="px-4 pt-4 pb-2">
        <Link
          href="/app/settings/profile"
          className="flex items-center gap-3 rounded-2xl bg-muted/40 p-4 transition-colors active:bg-muted/60"
        >
          <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary/70 shadow-sm ring-2 ring-primary/20">
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
                'absolute inset-0 flex items-center justify-center text-base font-bold text-primary-foreground',
                user?.avatar && 'hidden'
              )}
            >
              {(user?.name || 'م').charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {user?.name || 'المستخدم'}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {user?.email || 'إدارة حسابك'}
            </p>
          </div>
          <ChevronLeft className="size-4 text-muted-foreground/60" />
        </Link>
      </div>

      {/* Settings List */}
      <div className="px-4 pt-2 space-y-1.5">
        {settingsItems.map((item, index) => {
          const Icon = item.icon;

          if (item.type === 'direct') {
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.25 }}
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-3.5 rounded-xl bg-card p-3.5 border border-border/30 transition-colors active:bg-muted/50"
                >
                  <div className={cn('flex size-10 items-center justify-center rounded-full shrink-0', item.iconBg)}>
                    <Icon className={cn('size-5', item.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.description}</p>
                  </div>
                  <ChevronLeft className="size-4 text-muted-foreground/40 shrink-0" />
                </Link>
              </motion.div>
            );
          }

          // Expandable section
          const isExpanded = expandedSection === item.id;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.25 }}
            >
              <button
                type="button"
                onClick={() => toggleSection(item.id)}
                className={cn(
                  'flex w-full items-center gap-3.5 rounded-xl bg-card p-3.5 border border-border/30 transition-colors active:bg-muted/50',
                  isExpanded && 'rounded-b-none border-b-0'
                )}
              >
                <div className={cn('flex size-10 items-center justify-center rounded-full shrink-0', item.iconBg)}>
                  <Icon className={cn('size-5', item.iconColor)} />
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-[13px] font-semibold text-foreground">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.description}</p>
                </div>
                <ChevronDown
                  className={cn(
                    'size-4 text-muted-foreground/40 shrink-0 transition-transform duration-200',
                    isExpanded && 'rotate-180 text-primary'
                  )}
                />
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-b-xl bg-card border border-t-0 border-border/30 divide-y divide-border/20">
                      {item.items.map((subItem) => {
                        const SubIcon = subItem.icon;
                        return (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-muted/40"
                          >
                            <SubIcon className={cn('size-4 shrink-0', item.iconColor)} />
                            <span className="text-[13px] text-foreground flex-1">{subItem.label}</span>
                            <ChevronLeft className="size-3.5 text-muted-foreground/30" />
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
