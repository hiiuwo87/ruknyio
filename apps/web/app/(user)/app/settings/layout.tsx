'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePhonePreview } from '@/components/(app)/shared/phone-preview-context';
import { SettingsSidebarSlider } from '@/components/(app)/settings/SettingsSidebar';
import { SettingsMobileHome } from '@/components/(app)/settings/SettingsMobileHome';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { collapsed } = usePhonePreview();
  const isSettingsRoot = pathname === '/app/settings';

  return (
    <>
      {/* Mobile: Settings Home (card list) — only on root /app/settings */}
      {isSettingsRoot && (
        <div className="lg:hidden">
          <SettingsMobileHome />
        </div>
      )}

      {/* Mobile: Back header on sub-pages */}
      {!isSettingsRoot && (
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/80 backdrop-blur-xl border-b border-border/40 px-4 py-3 lg:hidden" dir="rtl">
          <Link
            href="/app/settings"
            className="flex items-center gap-1.5 text-sm text-primary font-medium"
          >
            <ArrowRight className="size-4" />
            <span>الإعدادات</span>
          </Link>
        </div>
      )}

      {/* Desktop layout + mobile sub-pages */}
      <div className={cn(
        'flex gap-4 min-h-[calc(100vh-5rem)]',
        collapsed && 'max-w-7xl',
        isSettingsRoot && 'hidden lg:flex'
      )}>
        {/* Main Content */}
        <div className="flex-1 min-w-0 pb-6 lg:pb-0">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </div>

        {/* Mobile Slider — only on desktop now since mobile has card nav */}
        <div className="hidden lg:block">
          <SettingsSidebarSlider />
        </div>
      </div>
    </>
  );
}
