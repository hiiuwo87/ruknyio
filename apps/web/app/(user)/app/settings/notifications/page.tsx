'use client';

import { useState, ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Mail,
  ShoppingBag,
  FileText,
  CalendarDays,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  SettingsSection,
  SettingsRow,
  ToggleSwitch,
} from '@/components/(app)/settings';

interface NotificationChannel {
  key: string;
  label: string;
  icon: ReactNode;
  description: string;
  enabled: boolean;
  status: 'active' | 'coming-soon';
  statusLabel: string;
}

interface NotificationType {
  key: string;
  label: string;
  icon: typeof ShoppingBag;
  description: string;
  email: boolean;
  push: boolean;
}

// Email SVG Icon
const EmailSVG = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="w-5 h-5"
  >
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <path d="m22 6-10 7L2 6" />
  </svg>
);

// Browser Notification SVG
const BrowserNotificationSVG = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className="w-5 h-5"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export default function NotificationsSettingsPage() {
  const [isSaving, setIsSaving] = useState(false);

  const [channels, setChannels] = useState<NotificationChannel[]>([
    {
      key: 'email',
      label: 'البريد الإلكتروني',
      icon: <EmailSVG />,
      description: 'استلام الإشعارات عبر بريدك الإلكتروني',
      enabled: true,
      status: 'active',
      statusLabel: 'فعالة',
    }
  ]);

  const [notificationTypes, setNotificationTypes] = useState<NotificationType[]>([
    {
      key: 'orders',
      label: 'الطلبات الجديدة',
      icon: ShoppingBag,
      description: 'عند استلام طلب جديد',
      email: true,
      push: false,
    },
    {
      key: 'forms',
      label: 'ردود النماذج',
      icon: FileText,
      description: 'عند استلام رد على نموذج',
      email: true,
      push: false,
    },
    {
      key: 'events',
      label: 'تذكيرات الأحداث',
      icon: CalendarDays,
      description: 'تذكير قبل موعد الحدث',
      email: true,
      push: false,
    },
    {
      key: 'promotions',
      label: 'العروض والتحديثات',
      icon: Bell,
      description: 'عروض ومميزات جديدة من ركني',
      email: false,
      push: false,
    },
  ]);

  const toggleChannel = (key: string) => {
    const channel = channels.find((ch) => ch.key === key);
    if (channel?.status === 'coming-soon') return;

    setChannels((prev) =>
      prev.map((ch) => (ch.key === key ? { ...ch, enabled: !ch.enabled } : ch))
    );
  };

  const toggleNotificationType = (
    key: string,
    field: 'email' | 'push'
  ) => {
    setNotificationTypes((prev) =>
      prev.map((nt) =>
        nt.key === key ? { ...nt, [field]: !nt[field] } : nt
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Notification Channels */}
      <SettingsSection
        title="قنوات الإشعارات"
        description="اختر الطريقة التي تفضل استلام الإشعارات بها"
      >
        <div className="space-y-3">
          {channels.map((channel) => (
            <motion.div
              key={channel.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <SettingsRow
                className={cn(
                  'border transition-all',
                  channel.status === 'coming-soon'
                    ? 'border-muted/30 bg-muted/20 opacity-75'
                    : 'border-border/30'
                )}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-xl',
                      channel.enabled
                        ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-600'
                        : channel.status === 'coming-soon'
                        ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-500'
                        : 'bg-muted/50 text-muted-foreground'
                    )}
                  >
                    {channel.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-foreground">
                        {channel.label}
                      </p>
                      {channel.status === 'active' && (
                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                      )}
                      {channel.status === 'coming-soon' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
                          {channel.statusLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {channel.description}
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={channel.enabled}
                  onChange={() => toggleChannel(channel.key)}
                  disabled={channel.status === 'coming-soon'}
                />
              </SettingsRow>
            </motion.div>
          ))}
        </div>
      </SettingsSection>

      {/* Notification Types */}
      <SettingsSection
        title="أنواع الإشعارات"
        description="اختر الإشعارات التي تريد استلامها عبر البريد الإلكتروني"
      >
        <div className="space-y-3">
          {notificationTypes.map((type, index) => (
            <motion.div
              key={type.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className="rounded-xl bg-background/50 px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 mt-0.5">
                  <type.icon className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground">
                    {type.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    {type.description}
                  </p>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <ToggleSwitch
                        checked={type.email}
                        onChange={() =>
                          toggleNotificationType(type.key, 'email')
                        }
                      />
                      <span className="text-[12px] text-muted-foreground group-hover:text-foreground transition-colors">
                        📧 بريد إلكتروني
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </SettingsSection>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="flex justify-end"
      >
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          <Save className="size-4" />
          {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </Button>
      </motion.div>
    </div>
  );
}
