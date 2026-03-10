/**
 * 🌐 RTL & Localization Helper for Admin Panel
 * 
 * استخدام هذه الدالات للتعامل مع الـ RTL والـ LTR
 */

export type Language = 'ar' | 'en';

export interface DirectionConfig {
  lang: Language;
  dir: 'rtl' | 'ltr';
  isRTL: boolean;
  isLTR: boolean;
}

/**
 * Get direction config based on language
 */
export function getDirectionConfig(lang: Language): DirectionConfig {
  const isArabic = lang === 'ar';
  return {
    lang,
    dir: isArabic ? 'rtl' : 'ltr',
    isRTL: isArabic,
    isLTR: !isArabic,
  };
}

/**
 * Margin/Padding utility helpers for RTL
 * 
 * Example:
 * - marginStart: margin-left في LTR, margin-right في RTL
 * - marginEnd: margin-right في LTR, margin-left في RTL
 */
export function getSpacingClasses(
  position: 'start' | 'end',
  value: string,
  isRTL: boolean
): string {
  if (position === 'start') {
    return isRTL ? `mr-${value}` : `ml-${value}`;
  }
  return isRTL ? `ml-${value}` : `mr-${value}`;
}

/**
 * Text alignment utility for RTL
 */
export function getTextAlignClass(align: 'start' | 'end' | 'center', isRTL: boolean): string {
  if (align === 'center') return 'text-center';
  if (align === 'start') {
    return isRTL ? 'text-right' : 'text-left';
  }
  return isRTL ? 'text-left' : 'text-right';
}

/**
 * Use in React components for dynamic RTL support
 * 
 * Usage:
 * const { dir, lang, isRTL } = useDirection();
 */
export function useDirection(): DirectionConfig {
  if (typeof window === 'undefined') {
    return getDirectionConfig('ar'); // Default to Arabic
  }

  const htmlElement = document.documentElement;
  const lang = (htmlElement.lang || 'ar') as Language;
  
  return getDirectionConfig(lang);
}

/**
 * Update HTML direction
 */
export function setDirection(lang: Language): void {
  if (typeof window === 'undefined') return;

  const htmlElement = document.documentElement;
  const config = getDirectionConfig(lang);

  htmlElement.lang = lang;
  htmlElement.dir = config.dir;
  
  // Store in localStorage for persistence
  localStorage.setItem('language', lang);
}

/**
 * Get stored language preference
 */
export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'ar';
  
  const stored = localStorage.getItem('language');
  return (stored === 'en' ? 'en' : 'ar') as Language;
}
