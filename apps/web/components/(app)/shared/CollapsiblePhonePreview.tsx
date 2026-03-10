'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelRightClose, PanelRightOpen, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PhonePreview } from './PhonePreview';
import { PhonePreviewContext } from './phone-preview-context';

const STORAGE_KEY = 'rukny-phone-preview-collapsed';

export function CollapsiblePhonePreview({ children }: { children?: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load saved state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'true') setCollapsed(true);
    } catch {}
    setMounted(true);
  }, []);

  // Save state to localStorage
  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  // Prevent hydration mismatch
  if (!mounted) return <>{children}</>;

  return (
    <PhonePreviewContext.Provider value={{ collapsed, toggle }}>
      {children}
      <div className="hidden xl:flex h-full relative">
        {/* Toggle Button */}
        <button
          onClick={toggle}
          className={cn(
            'absolute top-3 z-10 flex items-center justify-center',
            'w-8 h-8 rounded-xl',
            'bg-card border border-border/50 shadow-sm',
            'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            'transition-all duration-200',
            collapsed ? 'right-1/2 translate-x-1/2' : '-right-1'
          )}
          title={collapsed ? 'عرض المعاينة' : 'إخفاء المعاينة'}
        >
          {collapsed ? (
            <PanelRightOpen className="size-4" />
          ) : (
            <PanelRightClose className="size-4" />
          )}
        </button>

        {/* Content */}
        <motion.div
          initial={false}
          animate={{
            width: collapsed ? 48 : 320,
            opacity: 1,
          }}
          transition={{
            width: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
          }}
          className="h-full overflow-hidden flex-shrink-0"
        >
          <AnimatePresence mode="wait">
            {collapsed ? (
              <motion.div
                key="collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, delay: 0.15 }}
                className="flex flex-col items-center pt-14 gap-3 h-full"
              >
                <div className="w-9 h-9 rounded-xl bg-muted/40 flex items-center justify-center">
                  <Smartphone className="size-4 text-muted-foreground" />
                </div>
                <span className="text-[10px] text-muted-foreground [writing-mode:vertical-rl] rotate-180">
                  معاينة مباشرة
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
                className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pt-2"
              >
                <PhonePreview />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </PhonePreviewContext.Provider>
  );
}
