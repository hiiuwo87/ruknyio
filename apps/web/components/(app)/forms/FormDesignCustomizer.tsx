'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette,
  Type,
  Image as ImageIcon,
  MousePointerClick,
  Play,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type FormTheme,
  type BackgroundType,
  type ButtonShape,
  type FontFamily,
  DEFAULT_THEME,
} from './FormThemeCustomizer';

// ============================================
// Gradient Presets
// ============================================

interface GradientPreset {
  id: string;
  nameAr: string;
  css: string;
  textColor: 'light' | 'dark';
  accentColor: string;
}

const GRADIENT_PRESETS: GradientPreset[] = [
  { id: 'ocean-wave', nameAr: 'موج المحيط', css: 'linear-gradient(135deg, #0f766e 0%, #0ea5e9 50%, #6366f1 100%)', textColor: 'light', accentColor: '#34d399' },
  { id: 'sunset-glow', nameAr: 'توهّج الغروب', css: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #8b5cf6 100%)', textColor: 'light', accentColor: '#fb923c' },
  { id: 'midnight', nameAr: 'منتصف الليل', css: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)', textColor: 'light', accentColor: '#818cf8' },
  { id: 'forest', nameAr: 'غابة', css: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)', textColor: 'light', accentColor: '#6ee7b7' },
  { id: 'rose-garden', nameAr: 'حديقة ورد', css: 'linear-gradient(135deg, #881337 0%, #be185d 50%, #db2777 100%)', textColor: 'light', accentColor: '#f9a8d4' },
  { id: 'arctic', nameAr: 'القطب الشمالي', css: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #7dd3fc 100%)', textColor: 'dark', accentColor: '#0284c7' },
  { id: 'golden-hour', nameAr: 'الساعة الذهبية', css: 'linear-gradient(135deg, #fef3c7 0%, #fcd34d 50%, #f59e0b 100%)', textColor: 'dark', accentColor: '#b45309' },
  { id: 'lavender', nameAr: 'لافندر', css: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 50%, #c4b5fd 100%)', textColor: 'dark', accentColor: '#7c3aed' },
  { id: 'aurora', nameAr: 'الشفق القطبي', css: 'linear-gradient(135deg, #042f2e 0%, #0f766e 30%, #8b5cf6 70%, #ec4899 100%)', textColor: 'light', accentColor: '#5eead4' },
  { id: 'neon-city', nameAr: 'مدينة نيون', css: 'linear-gradient(135deg, #18181b 0%, #3f3f46 30%, #7c3aed 70%, #06b6d4 100%)', textColor: 'light', accentColor: '#22d3ee' },
  { id: 'coral-reef', nameAr: 'شعب مرجانية', css: 'linear-gradient(135deg, #0891b2 0%, #06b6d4 30%, #f97316 70%, #ef4444 100%)', textColor: 'light', accentColor: '#67e8f9' },
  { id: 'mesh-purple', nameAr: 'شبكة بنفسجية', css: 'radial-gradient(at 40% 20%, #818cf8 0px, transparent 50%), radial-gradient(at 80% 0%, #c084fc 0px, transparent 50%), radial-gradient(at 0% 50%, #6366f1 0px, transparent 50%), radial-gradient(at 80% 50%, #a78bfa 0px, transparent 50%), radial-gradient(at 0% 100%, #7c3aed 0px, transparent 50%)', textColor: 'light', accentColor: '#e9d5ff' },
];

// ============================================
// Wallpaper Presets (fetched from API)
// ============================================

interface WallpaperPreset {
  id: string;
  nameAr: string;
  url: string;
  fileType: 'image' | 'video';
}

// ============================================
// Font Options
// ============================================

interface FontOption {
  value: FontFamily;
  label: string;
  labelAr: string;
  css: string;
  preview: string;
}

const FONT_OPTIONS: FontOption[] = [
  { value: 'default', label: 'System', labelAr: 'افتراضي', css: 'inherit', preview: 'أهلاً بك' },
  { value: 'cairo', label: 'Cairo', labelAr: 'القاهرة', css: '"Cairo", sans-serif', preview: 'أهلاً بك' },
  { value: 'tajawal', label: 'Tajawal', labelAr: 'تجوال', css: '"Tajawal", sans-serif', preview: 'أهلاً بك' },
  { value: 'almarai', label: 'Almarai', labelAr: 'المرعي', css: '"Almarai", sans-serif', preview: 'أهلاً بك' },
  { value: 'ibm-plex', label: 'IBM Plex', labelAr: 'آي بي إم', css: '"IBM Plex Sans Arabic", sans-serif', preview: 'أهلاً بك' },
  { value: 'readex', label: 'Readex Pro', labelAr: 'ريدكس', css: '"Readex Pro", sans-serif', preview: 'أهلاً بك' },
  { value: 'noto-kufi', label: 'Noto Kufi', labelAr: 'نوتو كوفي', css: '"Noto Kufi Arabic", sans-serif', preview: 'أهلاً بك' },
  { value: 'modern', label: 'Modern', labelAr: 'عصري', css: '"Rubik", sans-serif', preview: 'أهلاً بك' },
  { value: 'classic', label: 'Classic', labelAr: 'كلاسيك', css: '"Noto Naskh Arabic", serif', preview: 'أهلاً بك' },
  { value: 'playful', label: 'Playful', labelAr: 'مرح', css: '"Changa", sans-serif', preview: 'أهلاً بك' },
];

// ============================================
// Quick Colors
// ============================================

const QUICK_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#64748b',
  '#171717', '#ffffff', '#f8fafc',
];

// ============================================
// Color Picker (inline)
// ============================================

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

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
              <div className="grid grid-cols-9 gap-1 mb-2">
                {QUICK_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => { onChange(color); setIsOpen(false); }}
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
// Main Component
// ============================================

interface FormDesignCustomizerProps {
  theme: FormTheme;
  onChange: (theme: FormTheme) => void;
}

export function FormDesignCustomizer({ theme, onChange }: FormDesignCustomizerProps) {
  const [activeTab, setActiveTab] = useState<'background' | 'fonts' | 'colors' | 'button'>('background');
  const [bgSubTab, setBgSubTab] = useState<'gradients' | 'wallpapers'>('wallpapers');
  const [wallpapers, setWallpapers] = useState<WallpaperPreset[]>([]);
  const [wallpapersLoading, setWallpapersLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/wallpapers')
      .then((res) => res.ok ? res.json() : [])
      .then((data: WallpaperPreset[]) => setWallpapers(data))
      .catch(() => setWallpapers([]))
      .finally(() => setWallpapersLoading(false));
  }, []);

  const updateTheme = useCallback((updates: Partial<FormTheme>) => {
    onChange({ ...theme, ...updates });
  }, [theme, onChange]);

  // Apply gradient preset
  const applyGradient = useCallback((preset: GradientPreset) => {
    updateTheme({
      backgroundType: 'gradient',
      backgroundGradient: preset.css,
      backgroundPreset: preset.id,
      backgroundImage: undefined,
      backgroundVideo: undefined,
      backgroundBlur: 0,
      backgroundOverlay: 0,
      textColor: preset.textColor === 'light' ? '#ffffff' : '#1f2937',
      primaryColor: preset.accentColor,
      accentColor: preset.accentColor,
    });
  }, [updateTheme]);

  // Apply wallpaper preset
  const applyWallpaper = useCallback((preset: WallpaperPreset) => {
    const stableUrl = `/api/v1/wallpapers/${preset.id}/file`;
    updateTheme({
      backgroundType: preset.fileType === 'video' ? 'video' : 'image',
      backgroundPreset: preset.id,
      backgroundImage: preset.fileType === 'image' ? stableUrl : undefined,
      backgroundVideo: preset.fileType === 'video' ? stableUrl : undefined,
      backgroundGradient: undefined,
      backgroundBlur: 0,
      backgroundOverlay: 20,
    });
  }, [updateTheme]);

  const tabs = [
    { id: 'background' as const, label: 'الخلفية', icon: ImageIcon },
    { id: 'fonts' as const, label: 'الخطوط', icon: Type },
    { id: 'colors' as const, label: 'الألوان', icon: Palette },
    { id: 'button' as const, label: 'الزر', icon: MousePointerClick },
  ];

  const hasMediaBg = theme.backgroundType === 'image' || theme.backgroundType === 'video';
  const showBlurSlider = hasMediaBg;
  const showOverlaySlider = hasMediaBg || theme.backgroundType === 'gradient';

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-0.5 p-0.5 bg-muted/50 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-medium transition-all",
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

      <AnimatePresence mode="wait">
        {/* ═══════════════════════════════════════════ */}
        {/* Background Tab                              */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === 'background' && (
          <motion.div
            key="background"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            {/* Sub-tabs: تدرجات | خلفيات */}
            <div className="flex items-center gap-1 p-0.5 bg-muted/40 rounded-lg">
              <button
                type="button"
                onClick={() => setBgSubTab('wallpapers')}
                className={cn(
                  "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all text-center",
                  bgSubTab === 'wallpapers'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                خلفيات جاهزة
              </button>
              <button
                type="button"
                onClick={() => setBgSubTab('gradients')}
                className={cn(
                  "flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all text-center",
                  bgSubTab === 'gradients'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                تدرجات لونية
              </button>
            </div>

            {/* ── Wallpapers Sub-tab ── */}
            {bgSubTab === 'wallpapers' && (
              <div className="space-y-2">
                {wallpapersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : wallpapers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد خلفيات متاحة</p>
                ) : (
                <div className="grid grid-cols-3 gap-2">
                  {wallpapers.map((preset) => {
                    const isSelected = theme.backgroundPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyWallpaper(preset)}
                        className={cn(
                          "relative group rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.03] hover:shadow-md",
                          isSelected
                            ? "border-primary ring-2 ring-primary/30 shadow-md"
                            : "border-border/60 hover:border-border"
                        )}
                      >
                        <div className="aspect-square relative bg-muted overflow-hidden">
                          {preset.fileType === 'video' ? (
                            <video
                              src={preset.url}
                              className="w-full h-full object-cover"
                              muted
                              autoPlay
                              loop
                              playsInline
                              style={{
                                filter: isSelected && theme.backgroundBlur ? `blur(${theme.backgroundBlur}px)` : undefined,
                                transform: isSelected && theme.backgroundBlur ? 'scale(1.1)' : undefined,
                              }}
                            />
                          ) : (
                            <img
                              src={preset.url}
                              alt={preset.nameAr}
                              className="w-full h-full object-cover"
                              style={{
                                filter: isSelected && theme.backgroundBlur ? `blur(${theme.backgroundBlur}px)` : undefined,
                                transform: isSelected && theme.backgroundBlur ? 'scale(1.1)' : undefined,
                              }}
                            />
                          )}
                          {/* Overlay preview */}
                          {isSelected && theme.backgroundOverlay && theme.backgroundOverlay > 0 && (
                            <div
                              className="absolute inset-0"
                              style={{ backgroundColor: `rgba(0,0,0,${theme.backgroundOverlay / 100})` }}
                            />
                          )}
                          {/* Video badge */}
                          {preset.fileType === 'video' && (
                            <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-sm rounded-full p-0.5">
                              <Play className="w-2.5 h-2.5 text-white fill-white" />
                            </div>
                          )}
                          {/* Selected check */}
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5 shadow-sm">
                              <Check className="w-2.5 h-2.5 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                )}
              </div>
            )}

            {/* ── Gradients Sub-tab ── */}
            {bgSubTab === 'gradients' && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {GRADIENT_PRESETS.map((preset) => {
                    const isSelected = theme.backgroundPreset === preset.id && theme.backgroundType === 'gradient';
                    const txtColor = preset.textColor === 'light' ? '#fff' : '#1f2937';
                    const mutedTxt = preset.textColor === 'light' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.25)';
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyGradient(preset)}
                        className={cn(
                          "relative group rounded-2xl overflow-hidden transition-all hover:scale-[1.03] hover:shadow-md",
                          isSelected
                            ? "border-primary ring-2 ring-primary/30 shadow-md"
                            : "border-border/60 hover:border-border"
                        )}
                      >
                        <div
                          className="aspect-square m-2 rounded-2xl flex items-center justify-center"
                          style={{ background: preset.css }}
                        >
                          <span
                            className="text-xl font-bold"
                            style={{ color: txtColor }}
                          >
                            Aa
                          </span>
                        </div>
                        <div className="bg-background m-2 px-1.5 py-1 text-center rounded-md">
                          <span className="text-[9px] font-medium text-foreground/80">{preset.nameAr}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Blur Slider (for image/video wallpapers) */}
            {showBlurSlider && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground/80">تغويش (Blur)</label>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{theme.backgroundBlur || 0}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={theme.backgroundBlur || 0}
                  onChange={(e) => updateTheme({ backgroundBlur: Number(e.target.value) })}
                  className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                />
              </div>
            )}

            {/* Overlay Slider */}
            {showOverlaySlider && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground/80">طبقة داكنة</label>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{theme.backgroundOverlay || 0}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={80}
                  step={5}
                  value={theme.backgroundOverlay || 0}
                  onChange={(e) => updateTheme({ backgroundOverlay: Number(e.target.value) })}
                  className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                />
              </div>
            )}

            {/* Background Fit Mode (for image/video) */}
            {hasMediaBg && (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-medium text-foreground/80">وضع العرض</label>
                <div className="flex items-center gap-1 p-0.5 bg-muted/40 rounded-lg">
                  {([
                    { value: 'cover' as const, label: 'ملء الشاشة' },
                    { value: 'contain' as const, label: 'إظهار الكل' },
                    { value: 'fill' as const, label: 'تمديد' },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateTheme({ backgroundFit: opt.value })}
                      className={cn(
                        "flex-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-all text-center",
                        (theme.backgroundFit || 'cover') === opt.value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* Fonts Tab                                   */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === 'fonts' && (
          <motion.div
            key="fonts"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            {/* Font Family */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80">نوع الخط</label>
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto [&::-webkit-scrollbar]:hidden">
                {FONT_OPTIONS.map((font) => (
                  <button
                    key={font.value}
                    type="button"
                    onClick={() => updateTheme({ fontFamily: font.value })}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-xl border transition-all",
                      theme.fontFamily === font.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-background hover:bg-muted/50"
                    )}
                  >
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-[11px] text-muted-foreground">{font.label}</span>
                      <span
                        className="text-lg leading-tight text-foreground"
                        style={{ fontFamily: font.css }}
                      >
                        {font.preview}
                      </span>
                    </div>
                    {theme.fontFamily === font.value && (
                      <div className="bg-primary rounded-full p-0.5">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80">حجم الخط</label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { value: 'small' as const, label: 'صغير', size: 'text-sm' },
                  { value: 'medium' as const, label: 'متوسط', size: 'text-base' },
                  { value: 'large' as const, label: 'كبير', size: 'text-lg' },
                ]).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => updateTheme({ fontSize: item.value })}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all",
                      theme.fontSize === item.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <span className={cn("font-medium", item.size)}>أ</span>
                    <span className="text-[9px] font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* Colors Tab                                  */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === 'colors' && (
          <motion.div
            key="colors"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-3"
          >
            <p className="text-[10px] text-muted-foreground">ألوان العناصر الأساسية في النموذج</p>
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

            {/* Appearance */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-medium text-foreground/80">المظهر</label>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { value: 'light' as const, label: 'فاتح', icon: '☀️' },
                  { value: 'dark' as const, label: 'داكن', icon: '🌙' },
                  { value: 'system' as const, label: 'تلقائي', icon: '💻' },
                ]).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => updateTheme({ appearance: item.value })}
                    className={cn(
                      "flex items-center justify-center gap-1.5 p-2 rounded-lg border transition-all",
                      theme.appearance === item.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border bg-background hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* Button & Footer Tab                         */}
        {/* ═══════════════════════════════════════════ */}
        {activeTab === 'button' && (
          <motion.div
            key="button"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            {/* Submit Button Section */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-foreground">زر الإرسال</label>

              {/* Button Shape */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground">شكل الزر</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { value: 'square' as const, label: 'مربع', radius: '4px' },
                    { value: 'rounded' as const, label: 'مدوّر', radius: '12px' },
                    { value: 'pill' as const, label: 'كبسولة', radius: '9999px' },
                  ]).map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => updateTheme({
                        submitButton: { ...DEFAULT_THEME.submitButton!, ...theme.submitButton, shape: item.value },
                      })}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all",
                        theme.submitButton?.shape === item.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-background hover:bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <div
                        className="w-12 h-5 bg-primary/80"
                        style={{ borderRadius: item.radius }}
                      />
                      <span className="text-[9px] font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Button Text */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground">نص الزر</label>
                <input
                  type="text"
                  value={theme.submitButton?.text || 'إرسال'}
                  onChange={(e) => updateTheme({
                    submitButton: { ...DEFAULT_THEME.submitButton!, ...theme.submitButton, text: e.target.value },
                  })}
                  placeholder="إرسال"
                  className="w-full h-8 px-3 text-xs rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                  dir="rtl"
                />
              </div>

              {/* Button Colors */}
              <ColorPicker
                label="لون الزر"
                value={theme.submitButton?.color || '#6366f1'}
                onChange={(c) => updateTheme({
                  submitButton: { ...DEFAULT_THEME.submitButton!, ...theme.submitButton, color: c },
                })}
              />
              <ColorPicker
                label="لون النص"
                value={theme.submitButton?.textColor || '#ffffff'}
                onChange={(c) => updateTheme({
                  submitButton: { ...DEFAULT_THEME.submitButton!, ...theme.submitButton, textColor: c },
                })}
              />

              {/* Full Width Toggle */}
              <button
                type="button"
                onClick={() => updateTheme({
                  submitButton: { ...DEFAULT_THEME.submitButton!, ...theme.submitButton, fullWidth: !theme.submitButton?.fullWidth },
                })}
                className={cn(
                  "w-full flex items-center justify-between p-2.5 rounded-lg border transition-all",
                  theme.submitButton?.fullWidth
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background"
                )}
              >
                <span className="text-xs text-foreground/80">عرض كامل</span>
                <div className={cn(
                  "w-8 h-4.5 rounded-full transition-colors relative",
                  theme.submitButton?.fullWidth ? "bg-primary" : "bg-muted"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all",
                    theme.submitButton?.fullWidth ? "right-0.5" : "left-0.5"
                  )} />
                </div>
              </button>

              {/* Button Preview */}
              <div className="pt-1">
                <label className="text-[10px] text-muted-foreground mb-2 block">معاينة</label>
                <div className={cn("flex", theme.submitButton?.fullWidth ? "" : "justify-center")}>
                  <div
                    className={cn(
                      "px-6 py-2.5 text-sm font-medium transition-all",
                      theme.submitButton?.fullWidth ? "w-full text-center" : ""
                    )}
                    style={{
                      backgroundColor: theme.submitButton?.color || '#6366f1',
                      color: theme.submitButton?.textColor || '#ffffff',
                      borderRadius: theme.submitButton?.shape === 'square' ? '4px'
                        : theme.submitButton?.shape === 'pill' ? '9999px'
                        : '12px',
                    }}
                  >
                    {theme.submitButton?.text || 'إرسال'}
                  </div>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* Footer Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">تذييل النموذج</label>
                <button
                  type="button"
                  onClick={() => updateTheme({
                    footer: { ...DEFAULT_THEME.footer!, ...theme.footer, show: !theme.footer?.show },
                  })}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {theme.footer?.show !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              {theme.footer?.show !== false && (
                <>
                  {/* Custom Footer Text */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground">نص التذييل (اختياري)</label>
                    <input
                      type="text"
                      value={theme.footer?.text || ''}
                      onChange={(e) => updateTheme({
                        footer: { ...DEFAULT_THEME.footer!, ...theme.footer, text: e.target.value },
                      })}
                      placeholder="مثال: شكراً لوقتك"
                      className="w-full h-8 px-3 text-xs rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                      dir="rtl"
                    />
                  </div>

                  {/* Branding Toggle */}
                  <button
                    type="button"
                    onClick={() => updateTheme({
                      footer: { ...DEFAULT_THEME.footer!, ...theme.footer, showBranding: !theme.footer?.showBranding },
                    })}
                    className={cn(
                      "w-full flex items-center justify-between p-2.5 rounded-lg border transition-all",
                      theme.footer?.showBranding !== false
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background"
                    )}
                  >
                    <span className="text-xs text-foreground/80">عرض شعار ركني</span>
                    <div className={cn(
                      "w-8 h-4.5 rounded-full transition-colors relative",
                      theme.footer?.showBranding !== false ? "bg-primary" : "bg-muted"
                    )}>
                      <div className={cn(
                        "absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all",
                        theme.footer?.showBranding !== false ? "right-0.5" : "left-0.5"
                      )} />
                    </div>
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FormDesignCustomizer;
