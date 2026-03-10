// Form Theme Types
// هذا الملف يحتوي على جميع الأنواع المتعلقة بتخصيص تصميم النماذج

export interface FormThemeColors {
  // الألوان الأساسية
  background: string;           // خلفية الصفحة
  card: string;                 // خلفية البطاقة
  primary: string;              // اللون الأساسي
  secondary: string;            // اللون الثانوي
  accent: string;               // لون التمييز
  
  // ألوان الحقول
  input: {
    background: string;         // خلفية الحقل
    border: string;             // حدود الحقل
    focusBorder: string;        // حدود عند التركيز
    text: string;               // نص الحقل
  };
  
  // ألوان النصوص
  text: {
    heading: string;            // العناوين
    body: string;               // النص العادي
    label: string;              // التسميات
    placeholder: string;        // النص التوضيحي
  };
  
  // ألوان الأزرار
  button: {
    background: string;
    text: string;
    hover: string;
  };
}

export interface FormThemeTypography {
  fontFamily: string;           // نوع الخط
  sizes: {
    heading: string;            // حجم العناوين
    body: string;               // حجم النص
    label: string;              // حجم التسميات
  };
  weights: {
    heading: string;            // وزن العناوين
    body: string;               // وزن النص
  };
}

export type CardStyle = 'elevated' | 'flat' | 'outlined';
export type BorderRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
export type Shadow = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type Spacing = 'compact' | 'normal' | 'relaxed';
export type MaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';

export interface FormThemeLayout {
  cardStyle: CardStyle;         // نمط البطاقة
  borderRadius: BorderRadius;   // الحواف
  shadow: Shadow;               // الظل
  spacing: Spacing;             // المسافات
  maxWidth: MaxWidth;           // العرض الأقصى
}

export type BackgroundType = 'solid' | 'gradient' | 'image';

export interface FormThemeAdvanced {
  backgroundType: BackgroundType;
  backgroundGradient?: string;  // مثل: 'linear-gradient(to right, #062C30, #0a4854)'
  backgroundImage?: string;     // رابط الصورة
  backgroundBlur?: number;      // تأثير الـ blur على الصورة
  darkMode: boolean;            // تفعيل الوضع الليلي
  animations: boolean;          // تفعيل الرسوم المتحركة
  customCSS?: string;           // CSS مخصص
}

export interface FormTheme {
  // الصور
  coverImage?: string;          // صورة الغلاف
  logo?: string;                // الشعار
  favicon?: string;             // الأيقونة
  
  // التصميم
  colors: FormThemeColors;
  typography: FormThemeTypography;
  layout: FormThemeLayout;
  
  // متقدم (اختياري)
  advanced?: FormThemeAdvanced;
}

// الثيم الافتراضي
export const DEFAULT_FORM_THEME: FormTheme = {
  colors: {
    background: '#f8fafc',
    card: '#ffffff',
    primary: '#062C30',
    secondary: '#0a4854',
    accent: '#3b82f6',
    input: {
      background: '#ffffff',
      border: '#e2e8f0',
      focusBorder: '#062C30',
      text: '#1e293b',
    },
    text: {
      heading: '#0f172a',
      body: '#475569',
      label: '#64748b',
      placeholder: '#94a3b8',
    },
    button: {
      background: '#062C30',
      text: '#ffffff',
      hover: '#0a4854',
    },
  },
  typography: {
    fontFamily: 'Cairo',
    sizes: {
      heading: '2xl',
      body: 'base',
      label: 'sm',
    },
    weights: {
      heading: 'bold',
      body: 'normal',
    },
  },
  layout: {
    cardStyle: 'elevated',
    borderRadius: 'lg',
    shadow: 'lg',
    spacing: 'normal',
    maxWidth: '2xl',
  },
  advanced: {
    backgroundType: 'solid',
    darkMode: false,
    animations: true,
  },
};

// خيارات الخطوط العربية
export const ARABIC_FONTS = [
  { value: 'Cairo', label: 'Cairo - القاهرة', preview: 'مرحباً بك' },
  { value: 'Tajawal', label: 'Tajawal - تجوال', preview: 'مرحباً بك' },
  { value: 'Almarai', label: 'Almarai - المرعي', preview: 'مرحباً بك' },
  { value: 'IBM Plex Sans Arabic', label: 'IBM Plex - آي بي إم', preview: 'مرحباً بك' },
  { value: 'Readex Pro', label: 'Readex Pro - ريدكس', preview: 'مرحباً بك' },
  { value: 'Noto Sans Arabic', label: 'Noto Sans - نوتو', preview: 'مرحباً بك' },
] as const;

// قوالب جاهزة
export const FORM_THEME_TEMPLATES = {
  minimal: {
    name: 'بسيط',
    description: 'تصميم نظيف وبسيط',
    theme: {
      ...DEFAULT_FORM_THEME,
      colors: {
        ...DEFAULT_FORM_THEME.colors,
        background: '#ffffff',
        card: '#ffffff',
        primary: '#000000',
      },
      layout: {
        ...DEFAULT_FORM_THEME.layout,
        cardStyle: 'flat' as CardStyle,
        shadow: 'none' as Shadow,
      },
    },
  },
  corporate: {
    name: 'احترافي',
    description: 'مناسب للشركات',
    theme: {
      ...DEFAULT_FORM_THEME,
      colors: {
        ...DEFAULT_FORM_THEME.colors,
        background: '#f1f5f9',
        primary: '#1e40af',
        secondary: '#3b82f6',
      },
    },
  },
  creative: {
    name: 'إبداعي',
    description: 'ألوان جريئة ومتميزة',
    theme: {
      ...DEFAULT_FORM_THEME,
      colors: {
        ...DEFAULT_FORM_THEME.colors,
        background: '#fef3c7',
        card: '#ffffff',
        primary: '#f59e0b',
        secondary: '#ef4444',
        accent: '#8b5cf6',
      },
      advanced: {
        ...DEFAULT_FORM_THEME.advanced,
        backgroundType: 'gradient' as BackgroundType,
        backgroundGradient: 'linear-gradient(135deg, #fef3c7 0%, #fce7f3 100%)',
      },
    },
  },
  dark: {
    name: 'داكن',
    description: 'وضع ليلي أنيق',
    theme: {
      ...DEFAULT_FORM_THEME,
      colors: {
        background: '#0f172a',
        card: '#1e293b',
        primary: '#3b82f6',
        secondary: '#60a5fa',
        accent: '#818cf8',
        input: {
          background: '#334155',
          border: '#475569',
          focusBorder: '#3b82f6',
          text: '#f1f5f9',
        },
        text: {
          heading: '#f8fafc',
          body: '#cbd5e1',
          label: '#94a3b8',
          placeholder: '#64748b',
        },
        button: {
          background: '#3b82f6',
          text: '#ffffff',
          hover: '#2563eb',
        },
      },
      advanced: {
        ...DEFAULT_FORM_THEME.advanced,
        darkMode: true,
      },
    },
  },
} as const;

export type FormThemeTemplate = keyof typeof FORM_THEME_TEMPLATES;
