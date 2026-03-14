'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette,
  Type,
  Square,
  Circle,
  Check,
  Sun,
  Moon,
  Sparkles,
  Monitor,
  Paintbrush,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

export type BackgroundType = 'solid' | 'gradient' | 'image' | 'video' | 'preset';
export type ButtonShape = 'square' | 'rounded' | 'pill';
export type FontFamily = 'default' | 'modern' | 'classic' | 'playful' | 'cairo' | 'tajawal' | 'almarai' | 'ibm-plex' | 'readex' | 'noto-kufi';

export interface SubmitButtonTheme {
  shape: ButtonShape;
  color: string;
  textColor: string;
  text: string;
  fullWidth: boolean;
}

export interface FooterTheme {
  show: boolean;
  text: string;
  showBranding: boolean;
}

export interface FormTheme {
  // Colors
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  accentColor: string;
  
  // Typography
  fontFamily: FontFamily;
  fontSize: 'small' | 'medium' | 'large';
  
  // Layout
  borderRadius: 'none' | 'small' | 'medium' | 'large' | 'full';
  fieldStyle: 'outlined' | 'filled' | 'underlined';
  spacing: 'compact' | 'normal' | 'relaxed';
  
  // Appearance
  appearance: 'light' | 'dark' | 'system';
  showLogo: boolean;
  
  // Preset
  presetId?: string;

  // Background
  backgroundType?: BackgroundType;
  backgroundImage?: string;
  backgroundVideo?: string;
  backgroundPreset?: string;
  backgroundGradient?: string;
  backgroundBlur?: number;
  backgroundOverlay?: number;
  backgroundFit?: 'cover' | 'contain' | 'fill';

  // Submit Button
  submitButton?: SubmitButtonTheme;

  // Footer
  footer?: FooterTheme;
}

export const DEFAULT_THEME: FormTheme = {
  primaryColor: '#6366f1',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  borderColor: '#e5e7eb',
  accentColor: '#8b5cf6',
  fontFamily: 'default',
  fontSize: 'medium',
  borderRadius: 'medium',
  fieldStyle: 'outlined',
  spacing: 'normal',
  appearance: 'light',
  showLogo: true,
  backgroundType: 'solid',
  backgroundBlur: 0,
  backgroundOverlay: 0,
  submitButton: {
    shape: 'rounded',
    color: '#6366f1',
    textColor: '#ffffff',
    text: 'إرسال',
    fullWidth: false,
  },
  footer: {
    show: true,
    text: '',
    showBranding: true,
  },
};

// ============================================
// Preset Themes
// ============================================

interface ThemePreset {
  id: string;
  name: string;
  nameAr: string;
  theme: Partial<FormTheme>;
  preview: {
    bg: string;
    primary: string;
    accent: string;
  };
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Default',
    nameAr: 'افتراضي',
    theme: {
      primaryColor: '#6366f1',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      borderColor: '#e5e7eb',
      accentColor: '#8b5cf6',
    },
    preview: { bg: '#ffffff', primary: '#6366f1', accent: '#8b5cf6' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    nameAr: 'محيط',
    theme: {
      primaryColor: '#0ea5e9',
      backgroundColor: '#f0f9ff',
      textColor: '#0c4a6e',
      borderColor: '#bae6fd',
      accentColor: '#06b6d4',
    },
    preview: { bg: '#f0f9ff', primary: '#0ea5e9', accent: '#06b6d4' },
  },
  {
    id: 'forest',
    name: 'Forest',
    nameAr: 'غابة',
    theme: {
      primaryColor: '#22c55e',
      backgroundColor: '#f0fdf4',
      textColor: '#14532d',
      borderColor: '#bbf7d0',
      accentColor: '#10b981',
    },
    preview: { bg: '#f0fdf4', primary: '#22c55e', accent: '#10b981' },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    nameAr: 'غروب',
    theme: {
      primaryColor: '#f97316',
      backgroundColor: '#fff7ed',
      textColor: '#7c2d12',
      borderColor: '#fed7aa',
      accentColor: '#fb923c',
    },
    preview: { bg: '#fff7ed', primary: '#f97316', accent: '#fb923c' },
  },
  {
    id: 'rose',
    name: 'Rose',
    nameAr: 'وردي',
    theme: {
      primaryColor: '#ec4899',
      backgroundColor: '#fdf2f8',
      textColor: '#831843',
      borderColor: '#fbcfe8',
      accentColor: '#f472b6',
    },
    preview: { bg: '#fdf2f8', primary: '#ec4899', accent: '#f472b6' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    nameAr: 'منتصف الليل',
    theme: {
      primaryColor: '#818cf8',
      backgroundColor: '#1e1b4b',
      textColor: '#e0e7ff',
      borderColor: '#3730a3',
      accentColor: '#a78bfa',
      appearance: 'dark',
    },
    preview: { bg: '#1e1b4b', primary: '#818cf8', accent: '#a78bfa' },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    nameAr: 'بسيط',
    theme: {
      primaryColor: '#171717',
      backgroundColor: '#fafafa',
      textColor: '#171717',
      borderColor: '#d4d4d4',
      accentColor: '#525252',
      borderRadius: 'small',
    },
    preview: { bg: '#fafafa', primary: '#171717', accent: '#525252' },
  },
  {
    id: 'corporate',
    name: 'Corporate',
    nameAr: 'رسمي',
    theme: {
      primaryColor: '#1d4ed8',
      backgroundColor: '#ffffff',
      textColor: '#1e3a8a',
      borderColor: '#bfdbfe',
      accentColor: '#3b82f6',
      fontFamily: 'classic',
      borderRadius: 'small',
    },
    preview: { bg: '#ffffff', primary: '#1d4ed8', accent: '#3b82f6' },
  },
];

// ============================================
// Color Picker
// ============================================

const QUICK_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
  '#171717',
];

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="flex items-center gap-3">
      <label className="text-xs font-medium text-foreground/80 w-20 flex-shrink-0">{label}</label>
      <div className="relative flex-1">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-2 h-8 px-2 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
        >
          <div
            className="w-5 h-5 rounded border border-border/50"
            style={{ backgroundColor: value }}
          />
          <span className="text-xs text-muted-foreground flex-1 text-right font-mono">{value}</span>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-50 top-full mt-1 left-0 right-0 p-2 bg-popover border border-border rounded-lg shadow-lg"
            >
              <div className="grid grid-cols-8 gap-1 mb-2">
                {QUICK_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      onChange(color);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-5 h-5 rounded transition-all hover:scale-110 border",
                      value === color ? "border-foreground ring-1 ring-foreground" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="w-7 h-6 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => {
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                      onChange(e.target.value);
                    }
                  }}
                  placeholder="#000000"
                  className="flex-1 h-6 px-2 text-xs font-mono rounded border border-border bg-background"
                  dir="ltr"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================
// Option Selector
// ============================================

interface OptionItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface OptionSelectorProps {
  label: string;
  value: string;
  options: OptionItem[];
  onChange: (value: string) => void;
  columns?: number;
}

function OptionSelector({ label, value, options, onChange, columns = 4 }: OptionSelectorProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground/80">{label}</label>
      <div className={cn("grid gap-1.5", `grid-cols-${columns}`)}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all",
              value === option.value
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground"
            )}
          >
            {option.icon}
            <span className="text-[9px] font-medium">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

interface FormThemeCustomizerProps {
  theme: FormTheme;
  onChange: (theme: FormTheme) => void;
}

export function FormThemeCustomizer({ theme, onChange }: FormThemeCustomizerProps) {
  const [activeTab, setActiveTab] = React.useState<'presets' | 'colors' | 'style'>('presets');

  const updateTheme = (updates: Partial<FormTheme>) => {
    onChange({ ...theme, ...updates });
  };

  const applyPreset = (preset: ThemePreset) => {
    onChange({ ...DEFAULT_THEME, ...preset.theme, presetId: preset.id });
  };

  return (
    <div className="space-y-4">
      {/* Tabs with Reset */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-0.5 p-0.5 bg-muted/50 rounded-lg">
          {[
            { id: 'presets', label: 'سمات', icon: Sparkles },
            { id: 'colors', label: 'الألوان', icon: Palette },
            { id: 'style', label: 'التنسيق', icon: Paintbrush },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-all",
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_THEME)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted/50"
        >
          إعادة
        </button>
      </div>

      <div className="space-y-3">
        {/* Settings Panel */}
        <div className="space-y-3">
          <AnimatePresence mode="wait">
            {/* Presets Tab */}
            {activeTab === 'presets' && (
              <motion.div
                key="presets"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-3"
              >
                <div className="grid grid-cols-4 gap-2">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        "relative p-2 rounded-lg border text-center transition-all overflow-hidden group",
                        theme.presetId === preset.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/50 bg-background"
                      )}
                    >
                      {/* Preview Colors */}
                      <div className="flex items-center justify-center gap-1 mb-1.5">
                        <div
                          className="w-4 h-4 rounded-md"
                          style={{ backgroundColor: preset.preview.bg, border: '1px solid #e5e7eb' }}
                        />
                        <div
                          className="w-4 h-4 rounded-md"
                          style={{ backgroundColor: preset.preview.primary }}
                        />
                        <div
                          className="w-4 h-4 rounded-md"
                          style={{ backgroundColor: preset.preview.accent }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-foreground">{preset.nameAr}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Colors Tab */}
            {activeTab === 'colors' && (
              <motion.div
                key="colors"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-2"
              >
                <ColorPicker
                  label="الرئيسي"
                  value={theme.primaryColor}
                  onChange={(c) => updateTheme({ primaryColor: c, presetId: undefined })}
                />
                <ColorPicker
                  label="الخلفية"
                  value={theme.backgroundColor}
                  onChange={(c) => updateTheme({ backgroundColor: c, presetId: undefined })}
                />
                <ColorPicker
                  label="النص"
                  value={theme.textColor}
                  onChange={(c) => updateTheme({ textColor: c, presetId: undefined })}
                />
                <ColorPicker
                  label="الحدود"
                  value={theme.borderColor}
                  onChange={(c) => updateTheme({ borderColor: c, presetId: undefined })}
                />
                <ColorPicker
                  label="الثانوي"
                  value={theme.accentColor}
                  onChange={(c) => updateTheme({ accentColor: c, presetId: undefined })}
                />
              </motion.div>
            )}

            {/* Style Tab */}
            {activeTab === 'style' && (
              <motion.div
                key="style"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-3"
              >
                {/* Border Radius */}
                <OptionSelector
                  label="الزوايا"
                  value={theme.borderRadius}
                  onChange={(v) => updateTheme({ borderRadius: v as FormTheme['borderRadius'] })}
                  columns={5}
                  options={[
                    { value: 'none', label: 'حاد', icon: <Square className="w-4 h-4" /> },
                    { value: 'small', label: 'صغير', icon: <div className="w-4 h-4 border border-current rounded-sm" /> },
                    { value: 'medium', label: 'متوسط', icon: <div className="w-4 h-4 border border-current rounded-md" /> },
                    { value: 'large', label: 'كبير', icon: <div className="w-4 h-4 border border-current rounded-lg" /> },
                    { value: 'full', label: 'دائري', icon: <Circle className="w-4 h-4" /> },
                  ]}
                />

                {/* Field Style */}
                <OptionSelector
                  label="الحقول"
                  value={theme.fieldStyle}
                  onChange={(v) => updateTheme({ fieldStyle: v as FormTheme['fieldStyle'] })}
                  columns={3}
                  options={[
                    { 
                      value: 'outlined', 
                      label: 'محدد', 
                      icon: <div className="w-6 h-4 border border-current rounded" /> 
                    },
                    { 
                      value: 'filled', 
                      label: 'مملوء', 
                      icon: <div className="w-6 h-4 bg-current/20 rounded" /> 
                    },
                    { 
                      value: 'underlined', 
                      label: 'مسطر', 
                      icon: <div className="w-6 h-4 border-b border-current" /> 
                    },
                  ]}
                />

                {/* Appearance */}
                <OptionSelector
                  label="المظهر"
                  value={theme.appearance}
                  onChange={(v) => updateTheme({ appearance: v as FormTheme['appearance'] })}
                  columns={3}
                  options={[
                    { value: 'light', label: 'فاتح', icon: <Sun className="w-4 h-4" /> },
                    { value: 'dark', label: 'داكن', icon: <Moon className="w-4 h-4" /> },
                    { value: 'system', label: 'تلقائي', icon: <Monitor className="w-4 h-4" /> },
                  ]}
                />

                {/* Font Family */}
                <OptionSelector
                  label="الخط"
                  value={theme.fontFamily}
                  onChange={(v) => updateTheme({ fontFamily: v as FormTheme['fontFamily'] })}
                  columns={4}
                  options={[
                    { value: 'default', label: 'افتراضي', icon: <Type className="w-4 h-4" /> },
                    { value: 'modern', label: 'عصري', icon: <span className="text-sm font-light">Aa</span> },
                    { value: 'classic', label: 'كلاسيك', icon: <span className="text-sm font-serif">Aa</span> },
                    { value: 'playful', label: 'مرح', icon: <span className="text-sm font-bold">Aa</span> },
                  ]}
                />

                {/* Spacing */}
                <OptionSelector
                  label="المسافات"
                  value={theme.spacing}
                  onChange={(v) => updateTheme({ spacing: v as FormTheme['spacing'] })}
                  columns={3}
                  options={[
                    { value: 'compact', label: 'مضغوط', icon: <div className="flex flex-col gap-0"><div className="w-5 h-0.5 bg-current rounded" /><div className="w-5 h-0.5 bg-current rounded" /></div> },
                    { value: 'normal', label: 'عادي', icon: <div className="flex flex-col gap-0.5"><div className="w-5 h-0.5 bg-current rounded" /><div className="w-5 h-0.5 bg-current rounded" /></div> },
                    { value: 'relaxed', label: 'واسع', icon: <div className="flex flex-col gap-1"><div className="w-5 h-0.5 bg-current rounded" /><div className="w-5 h-0.5 bg-current rounded" /></div> },
                  ]}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default FormThemeCustomizer;
