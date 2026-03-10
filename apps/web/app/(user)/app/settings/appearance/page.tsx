'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  Type,
  Layout,
  Save,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  SettingsSection,
  SettingsField,
} from '@/components/(app)/settings';

const themes = [
  { key: 'light', label: 'فاتح', icon: Sun },
  { key: 'dark', label: 'داكن', icon: Moon },
  { key: 'system', label: 'تلقائي', icon: Monitor },
];

const accentColors = [
  { key: 'green', label: 'أخضر', color: 'bg-emerald-500', value: '#10b981' },
  { key: 'blue', label: 'أزرق', color: 'bg-blue-500', value: '#3b82f6' },
  { key: 'purple', label: 'بنفسجي', color: 'bg-purple-500', value: '#8b5cf6' },
  { key: 'rose', label: 'وردي', color: 'bg-rose-500', value: '#f43f5e' },
  { key: 'amber', label: 'ذهبي', color: 'bg-amber-500', value: '#f59e0b' },
  { key: 'teal', label: 'سماوي', color: 'bg-teal-500', value: '#14b8a6' },
];

const profileLayouts = [
  { key: 'classic', label: 'كلاسيكي', description: 'تخطيط تقليدي بسيط' },
  { key: 'modern', label: 'حديث', description: 'تصميم عصري حديث' },
  { key: 'minimal', label: 'مبسّط', description: 'تخطيط بسيط ونظيف' },
];

export default function AppearanceSettingsPage() {
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('system');
  const [selectedAccent, setSelectedAccent] = useState('green');
  const [selectedLayout, setSelectedLayout] = useState('classic');

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 1000));
    setIsSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Theme */}
      <SettingsSection title="السمة" description="اختر سمة الواجهة المفضلة لديك">
        <div className="grid grid-cols-3 gap-3">
          {themes.map((theme) => (
            <button
              key={theme.key}
              type="button"
              onClick={() => setSelectedTheme(theme.key)}
              className={cn(
                'relative flex flex-col items-center gap-2.5 rounded-2xl border-2 px-4 py-5 transition-all cursor-pointer',
                selectedTheme === theme.key
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-transparent bg-background/50 hover:bg-muted/50'
              )}
            >
              {selectedTheme === theme.key && (
                <motion.div
                  layoutId="theme-check"
                  className="absolute top-2 left-2 flex size-5 items-center justify-center rounded-full bg-primary"
                >
                  <Check className="size-3 text-primary-foreground" />
                </motion.div>
              )}
              <theme.icon
                className={cn(
                  'size-6',
                  selectedTheme === theme.key
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              />
              <span
                className={cn(
                  'text-[13px] font-medium',
                  selectedTheme === theme.key
                    ? 'text-primary'
                    : 'text-foreground/80'
                )}
              >
                {theme.label}
              </span>
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* Accent Color */}
      <SettingsSection title="اللون الرئيسي" description="اختر لون التمييز لصفحتك الشخصية">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {accentColors.map((accent) => (
            <button
              key={accent.key}
              type="button"
              onClick={() => setSelectedAccent(accent.key)}
              className={cn(
                'relative flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-3 transition-all cursor-pointer',
                selectedAccent === accent.key
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent bg-background/50 hover:bg-muted/50'
              )}
            >
              <div className="relative">
                <div
                  className={cn(
                    'size-8 rounded-full shadow-sm',
                    accent.color
                  )}
                />
                {selectedAccent === accent.key && (
                  <motion.div
                    layoutId="accent-check"
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Check className="size-4 text-white" />
                  </motion.div>
                )}
              </div>
              <span className="text-[11px] font-medium text-foreground/80">
                {accent.label}
              </span>
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* Profile Layout */}
      <SettingsSection
        title="تخطيط الصفحة الشخصية"
        description="اختر تخطيط صفحتك الشخصية العامة"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {profileLayouts.map((layout) => (
            <button
              key={layout.key}
              type="button"
              onClick={() => setSelectedLayout(layout.key)}
              className={cn(
                'relative flex flex-col items-center gap-3 rounded-2xl border-2 px-4 py-5 transition-all cursor-pointer',
                selectedLayout === layout.key
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-transparent bg-background/50 hover:bg-muted/50'
              )}
            >
              {selectedLayout === layout.key && (
                <motion.div
                  layoutId="layout-check"
                  className="absolute top-2 left-2 flex size-5 items-center justify-center rounded-full bg-primary"
                >
                  <Check className="size-3 text-primary-foreground" />
                </motion.div>
              )}
              {/* Layout Preview Placeholder */}
              <div className="w-full h-16 rounded-lg bg-muted/50 border border-border/30 flex items-center justify-center">
                <Layout className="size-5 text-muted-foreground/50" />
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    'text-[13px] font-medium',
                    selectedLayout === layout.key
                      ? 'text-primary'
                      : 'text-foreground/80'
                  )}
                >
                  {layout.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {layout.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* Save Button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
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
