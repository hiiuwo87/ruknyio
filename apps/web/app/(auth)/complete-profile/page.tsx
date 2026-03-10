'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthContext } from '@/lib/auth/auth-provider';
import { useUsernameCheck } from '@/lib/hooks/auth/use-username-check';
import { quickSignClient } from '@/lib/auth/quicksign-client';
import { setCsrfToken } from '@/lib/api/client';
import { sanitizeToken, handleError, logError, formLimiter } from '@/lib/security';
import { Loader2, CheckCircle2, XCircle, User, AlertTriangle, Store, Sparkles, FileText, MapPin, Phone, ShoppingBag, Utensils, Laptop, Palette, Home, Dumbbell, BookOpen, MoreHorizontal, Briefcase, Heart, Camera, Music, Car, Plane, Shirt, Gift, Gem, PawPrint, Baby, Hammer, Leaf, Coffee, Wrench, Smartphone, UtensilsCrossed, LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProgressIndicator from '@/components/ui/progress-indicator';
import { triggerCelebration } from '@/components/ui/confetti';
import { Select, SelectOption } from '@/components/ui/animated-select';

// 🔒 Text sanitization functions
const sanitizeName = (text: string): string => {
  // Allow Arabic, English letters, spaces, and common punctuation
  // Don't trim during typing - only remove dangerous characters
  return text
    .replace(/[<>{}[\]\\]/g, '') // Remove dangerous characters
    .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space (but allow single spaces)
    .slice(0, 50); // Max 50 characters
};

const sanitizeUsername = (text: string): string => {
  // Only allow lowercase letters, numbers, and underscores
  // Remove spaces and special characters immediately
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30); // Max 30 characters
};

const sanitizePhone = (text: string): string => {
  // Only allow numbers, + at the start, and spaces for formatting
  const cleaned = text
    .replace(/[^\d+\s]/g, '') // Allow digits, +, and spaces
    .replace(/(?!^)\+/g, '') // Remove + if not at start
    .replace(/\s{2,}/g, ' '); // Replace multiple spaces with single
  return cleaned.slice(0, 20); // Max 20 characters (with spaces)
};

const sanitizeDescription = (text: string): string => {
  // Allow Arabic, English, numbers, and common punctuation
  // Preserve newlines and spaces for natural text
  return text
    .replace(/[<>{}[\]\\]/g, '') // Remove dangerous characters only
    .slice(0, 500); // Max 500 characters
};

// 🔐 Helper لجلب Token بأمان من URL أو sessionStorage
const getProfileToken = (urlToken: string | null): string | null => {
  if (urlToken) {
    return sanitizeToken(urlToken);
  }
  
  if (typeof window !== 'undefined') {
    const sessionToken = sessionStorage.getItem('profile_completion_token');
    if (sessionToken) {
      return sanitizeToken(sessionToken);
    }
  }
  
  return null;
};

const clearProfileToken = (): void => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('profile_completion_token');
  }
};

// Icon mapper: converts icon name string from API to Lucide component
const ICON_MAP: Record<string, LucideIcon> = {
  Shirt,
  Smartphone,
  UtensilsCrossed,
  Sparkles,
  Home,
  Dumbbell,
  BookOpen,
  Car,
  Baby,
  Wrench,
  MoreHorizontal,
  Laptop,
  Utensils,
  Palette,
  Gem,
  Heart,
  Camera,
  Plane,
  Gift,
  PawPrint,
  Hammer,
  Leaf,
  Coffee,
  Briefcase,
  Store,
  ShoppingBag,
  Music,
};

const getIconComponent = (iconName?: string): LucideIcon => {
  if (!iconName) return Store;
  return ICON_MAP[iconName] || Store;
};

// Store category from API
interface StoreCategory {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  icon?: string;
  color?: string;
}

// Fallback categories (used if API fails)
const FALLBACK_CATEGORIES: StoreCategory[] = [
  { id: 'cat_fashion', name: 'Fashion', nameAr: 'الأزياء والموضة', slug: 'fashion', icon: 'Shirt', color: '#EC4899' },
  { id: 'cat_electronics', name: 'Electronics', nameAr: 'الإلكترونيات', slug: 'electronics', icon: 'Smartphone', color: '#3B82F6' },
  { id: 'cat_food', name: 'Food & Beverages', nameAr: 'الطعام والمشروبات', slug: 'food-beverages', icon: 'UtensilsCrossed', color: '#F59E0B' },
  { id: 'cat_beauty', name: 'Beauty & Health', nameAr: 'الجمال والصحة', slug: 'beauty-health', icon: 'Sparkles', color: '#8B5CF6' },
  { id: 'cat_home', name: 'Home & Garden', nameAr: 'المنزل والحديقة', slug: 'home-garden', icon: 'Home', color: '#10B981' },
  { id: 'cat_sports', name: 'Sports & Fitness', nameAr: 'الرياضة واللياقة', slug: 'sports-fitness', icon: 'Dumbbell', color: '#EF4444' },
  { id: 'cat_books', name: 'Books & Education', nameAr: 'الكتب والتعليم', slug: 'books-education', icon: 'BookOpen', color: '#6366F1' },
  { id: 'cat_automotive', name: 'Automotive', nameAr: 'السيارات', slug: 'automotive', icon: 'Car', color: '#64748B' },
  { id: 'cat_kids', name: 'Kids & Baby', nameAr: 'الأطفال والرضع', slug: 'kids-baby', icon: 'Baby', color: '#F472B6' },
  { id: 'cat_services', name: 'Services', nameAr: 'الخدمات', slug: 'services', icon: 'Wrench', color: '#0EA5E9' },
  { id: 'cat_other', name: 'Other', nameAr: 'أخرى', slug: 'other', icon: 'MoreHorizontal', color: '#94A3B8' },
];

// Employee count options
const employeeOptions = [
  { value: 'solo', label: 'أعمل بمفردي', emoji: '👤' },
  { value: '2-5', label: '2 - 5 موظفين', emoji: '👥' },
  { value: '6-10', label: '6 - 10 موظفين', emoji: '👨‍👩‍👧‍👦' },
  { value: '11-50', label: '11 - 50 موظف', emoji: '🏢' },
  { value: '50+', label: 'أكثر من 50 موظف', emoji: '🏙️' },
];

function CompleteProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlToken = searchParams.get('token');
  const [quickSignToken, setQuickSignToken] = useState<string | null>(null);
  const { setUser, user: currentUser, isAuthenticated } = useAuthContext();

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 2;

  // Step 1: Profile data
  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    username: '',
    phone: '',
  });

  // Step 2: Store settings
  const [storeData, setStoreData] = useState({
    storeDescription: '',
    category: '',
    categoryId: '',
    employeesCount: '',
    country: '',
    city: '',
    address: '',
    latitude: 0,
    longitude: 0,
  });

  // Store categories from API
  const [storeCategories, setStoreCategories] = useState<StoreCategory[]>(FALLBACK_CATEGORIES);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  const [isOAuthUser, setIsOAuthUser] = useState(false);
  
  const [progressStep, setProgressStep] = useState<'idle' | 'creating-account' | 'creating-store' | 'done'>('idle');
  const [storeCreationError, setStoreCreationError] = useState<string | null>(null);
  const [createdStoreSlug, setCreatedStoreSlug] = useState<string | null>(null);
  
  const { available, checking, error: usernameError } = useUsernameCheck(formData.username);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🔐 جلب Token عند التحميل
  useEffect(() => {
    const token = getProfileToken(urlToken);
    if (token) {
      setQuickSignToken(token);
    }
  }, [urlToken]);

  // 🏪 جلب فئات المتاجر من الـ API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setCategoriesLoading(true);
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api/v1';
        const res = await fetch(`${apiBase}/stores/categories`);
        if (res.ok) {
          const data = await res.json();
          if (data.categories && data.categories.length > 0) {
            setStoreCategories(data.categories);
          }
        }
      } catch {
        // Fallback to hardcoded categories
      } finally {
        setCategoriesLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Detect if OAuth user or QuickSign user
  useEffect(() => {
    if (isSubmitting) return;
    
    if (isAuthenticated) {
      router.push('/');
      return;
    }

    if (quickSignToken) {
      setIsOAuthUser(false);
    } else {
      console.warn('⚠️ No token and not authenticated, redirecting to login');
      const timer = setTimeout(() => {
        router.push('/login');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, quickSignToken, router, currentUser, isSubmitting]);

  // Composition flag to support IME (Arabic/other) input without aggressive sanitization
  const isComposing = useRef(false);

  const handleChange = useCallback((field: string, value: string) => {
    // If composing (IME), don't sanitize the name field yet to avoid breaking input
    if (field === 'name' && isComposing.current) {
      setFormData(prev => ({ ...prev, name: value }));
      setError(null);
      setRateLimitError(null);
      return;
    }

    let sanitizedValue = value;
    if (field === 'name') {
      sanitizedValue = sanitizeName(value);
    } else if (field === 'username') {
      sanitizedValue = sanitizeUsername(value);
    } else if (field === 'phone') {
      sanitizedValue = sanitizePhone(value);
    }
    
    setFormData(prev => ({ ...prev, [field]: sanitizedValue }));
    setError(null);
    setRateLimitError(null);
  }, []);

  const handleStoreChange = useCallback((field: string, value: string | boolean | number) => {
    let sanitizedValue = value;
    if (field === 'storeDescription' && typeof value === 'string') {
      sanitizedValue = sanitizeDescription(value);
    }
    if (field === 'category' && typeof value === 'string') {
      // When category slug changes, also resolve the categoryId
      const found = storeCategories.find(c => c.slug === value);
      setStoreData(prev => ({ ...prev, category: value, categoryId: found?.id || '' }));
      setError(null);
      return;
    }
    setStoreData(prev => ({ ...prev, [field]: sanitizedValue }));
    setError(null);
  }, [storeCategories]);


  const validateStep1 = useCallback((): boolean => {
    const name = formData.name.trim();
    const username = formData.username.trim();
    
    if (!name) {
      setError('الرجاء إدخال اسمك');
      return false;
    }

    if (name.length < 2) {
      setError('الاسم يجب أن يكون حرفين على الأقل');
      return false;
    }

    if (name.length > 50) {
      setError('الاسم طويل جداً (الحد الأقصى 50 حرف)');
      return false;
    }

    if (!username) {
      setError('الرجاء إدخال اسم المستخدم');
      return false;
    }

    if (username.length < 3) {
      setError('اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
      return false;
    }

    if (username.length > 30) {
      setError('اسم المستخدم طويل جداً (الحد الأقصى 30 حرف)');
      return false;
    }

    if (!/^[a-z][a-z0-9_]*$/.test(username)) {
      setError('اسم المستخدم يجب أن يبدأ بحرف ويحتوي على أحرف وأرقام وشرطة سفلية فقط');
      return false;
    }

    if (!available && !checking) {
      setError('اسم المستخدم غير متاح، جرب اسماً آخر');
      return false;
    }

    // Validate phone if provided
    if (formData.phone && formData.phone.length < 10) {
      setError('رقم الهاتف غير صحيح');
      return false;
    }

    return true;
  }, [formData.name, formData.username, formData.phone, available, checking]);

  const validateStep2 = useCallback((): boolean => {
    if (!storeData.category) {
      setError('الرجاء اختيار تصنيف المتجر');
      return false;
    }
    return true;
  }, [storeData.category]);

  const handleContinue = useCallback(() => {
    if (currentStep === 1) {
      if (!validateStep1()) return;
      setCurrentStep(2);
      setError(null);
    } else if (currentStep === 2) {
      // On last step, trigger form submission
      const form = document.querySelector('form');
      if (form) {
        form.requestSubmit();
      }
    }
  }, [currentStep, validateStep1]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  }, [currentStep]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quickSignToken && !isOAuthUser) return;
    
    // Validate based on current step
    if (currentStep === 1) {
      handleContinue();
      return;
    }
    
    if (!validateStep2()) return;

    // 🔒 Rate Limiting (UX)
    const rateLimitCheck = formLimiter.check('complete-profile');
    if (!rateLimitCheck.allowed) {
      const seconds = Math.ceil(rateLimitCheck.resetIn / 1000);
      setRateLimitError(`محاولات كثيرة، يرجى الانتظار ${seconds} ثانية`);
      return;
    }

    // منع التوجيه التلقائي أثناء عملية الإرسال
    setIsSubmitting(true);
    setLoading(true);
    setError(null);
    setRateLimitError(null);
    setStoreCreationError(null);

    let storeSlug: string | null = null;

    try {
      // المرحلة 1: إنشاء الحساب
      setProgressStep('creating-account');
      
      if (isOAuthUser) {
        // OAuth user: Update profile via /auth/me endpoint
        // TODO: Create update profile API call
        throw new Error('تحديث OAuth profile قيد التطوير');
      } else {
        // QuickSign user: Complete profile with token
        // Backend will automatically create Store with same name as username
        const response = await quickSignClient.completeProfile({
          quickSignToken: quickSignToken!,
          name: formData.name.trim(),
          username: formData.username.trim(),
          isVendor: true,
          storeCategory: storeData.category || undefined,
          storeCategoryId: storeData.categoryId || undefined,
          storeDescription: storeData.storeDescription.trim() || undefined,
          employeesCount: storeData.employeesCount || undefined,
          // Location fields - only send if location was selected
          storeCountry: storeData.country || undefined,
          storeCity: storeData.city || undefined,
          storeAddress: storeData.address || undefined,
          storeLatitude: storeData.latitude !== 0 ? storeData.latitude : undefined,
          storeLongitude: storeData.longitude !== 0 ? storeData.longitude : undefined,
        });

        // 🔒 Reset rate limiter on success
        formLimiter.reset('complete-profile');
        
        // 🔐 مسح الـ Token بعد النجاح
        clearProfileToken();
        
        // Set CSRF token and user data
        if (response.csrf_token) {
          setCsrfToken(response.csrf_token);
        }
        setUser(response.user);
        
        // Store created automatically by backend
        if (response.store) {
          storeSlug = response.store.slug;
          setCreatedStoreSlug(storeSlug);
        }
      }

      // المتجر يتم إنشاؤه تلقائياً من الـ Backend
      if (storeSlug) {
        setProgressStep('creating-store');
        // انتظر قليلاً لعرض رسالة إنشاء المتجر
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // اكتمال العملية!
      setProgressStep('done');

      // Trigger celebration confetti!
      triggerCelebration();

      // Redirect to welcome page with user name and store info after a short delay for confetti
      setTimeout(() => {
        const params = new URLSearchParams();
        params.set('name', formData.name.trim());
        
        if (storeSlug) {
          params.set('store', storeSlug);
          params.set('storeCreated', 'true');
        } else if (storeCreationError) {
          params.set('storeError', 'true');
        }
        
        router.push(`/welcome?${params.toString()}`);
      }, 1500);
    } catch (err: unknown) {
      logError(err, 'CompleteProfile');
      const { message } = handleError(err);
      setError(message);
      setProgressStep('idle');
    } finally {
      setLoading(false);
    }
  }, [quickSignToken, isOAuthUser, currentStep, validateStep2, formData, storeData, storeCreationError, setUser, router, handleContinue]);

  const displayError = rateLimitError || error;

  if (!quickSignToken && !isOAuthUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-6" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center text-center max-w-sm"
        >
          <div className="flex items-center justify-center size-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-6">
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-light text-foreground mb-2">رابط غير صالح</h1>
          <p className="text-sm text-muted-foreground mb-8">
            هذه الصفحة تتطلب رابط تسجيل صالح. سيتم توجيهك لصفحة تسجيل الدخول...
          </p>
          <button 
            onClick={() => router.push('/login')} 
            className="flex items-center justify-center w-full h-12 bg-foreground hover:bg-foreground/90 text-background font-medium rounded-full transition-all duration-300"
          >
            الذهاب لتسجيل الدخول
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-6" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center w-full max-w-md"
      >
        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full">
          <AnimatePresence mode="wait">
            {/* Step 1: Profile Information */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                {/* Header */}
                <div className="text-center mb-6">
                  <motion.span 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-2 text-xs bg-primary/10 text-primary font-semibold px-3 py-1.5 rounded-full mb-4"
                  >
                    إكمال الملف الشخصي
                  </motion.span>
                  <motion.h1 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-2xl sm:text-3xl font-bold text-foreground mb-2"
                  >
                    دعنا نكمل إعدادك
                  </motion.h1>
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-sm text-muted-foreground max-w-sm mx-auto"
                  >
                    أكمل بيانات ملفك الشخصي في خطوات بسيطة
                  </motion.p>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-medium text-foreground">
                    الاسم الكامل <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center h-11 pl-3 pr-3 border-2 border-slate-300 dark:border-slate-600 rounded-full bg-background focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary transition-all duration-200">
                    <User className="h-4.5 w-4.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                    <input
                      id="name"
                      type="text"
                      placeholder="أدخل اسمك الكامل"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      onCompositionStart={() => (isComposing.current = true)}
                      onCompositionEnd={(e) => {
                        isComposing.current = false;
                        // sanitize final composed value
                        handleChange('name', (e.currentTarget as HTMLInputElement).value);
                      }}
                      disabled={loading}
                      required
                      className="h-full px-2.5 w-full outline-none bg-transparent text-foreground placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    />
                  </div>
                </div>

                {/* Username */}
                <div className="space-y-2">
                  <label htmlFor="username" className="block text-sm font-medium text-foreground">
                    اسم المستخدم <span className="text-red-500">*</span>
                  </label>
                  <div className={`flex items-center h-11 pl-3 pr-3 border-2 rounded-full bg-background focus-within:ring-2 transition-all duration-200 ${
                    formData.username && !checking
                      ? available
                        ? 'border-emerald-500 focus-within:border-emerald-500 focus-within:ring-emerald-500/20'
                        : 'border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20'
                      : 'border-slate-300 dark:border-slate-600 focus-within:border-primary focus-within:ring-primary/50'
                  }`}>
                    <FileText className="h-4.5 w-4.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                    <input
                      id="username"
                      type="text"
                      placeholder="username"
                      value={formData.username}
                      onChange={(e) => handleChange('username', e.target.value)}
                      disabled={loading}
                      required
                      className="h-full px-2.5 w-full outline-none bg-transparent text-foreground placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      dir="ltr"
                    />
                    {formData.username && (
                      <div className="flex-shrink-0">
                        {checking ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                        ) : available ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                    )}
                  </div>
                  {formData.username && !checking && !available && (
                    <motion.p 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium" 
                      role="alert"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {usernameError || 'اسم المستخدم غير متاح، جرب اسماً آخر'}
                    </motion.p>
                  )}
                  {formData.username && !checking && available && (
                    <motion.p 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium" 
                      role="status"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      اسم المستخدم متاح ✓
                    </motion.p>
                  )}
                </div>

                {/* Phone (Optional) */}
                <div className="space-y-2">
                  <label htmlFor="phone" className="block text-sm font-medium text-foreground">
                    رقم الهاتف <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(اختياري)</span>
                  </label>
                  <div className="flex items-center h-11 pl-3 pr-3 border-2 border-slate-300 dark:border-slate-600 rounded-full bg-background focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary transition-all duration-200">
                    <Phone className="h-4.5 w-4.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                    <input
                      id="phone"
                      type="tel"
                      placeholder="+964 770 123 4567"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      disabled={loading}
                      className="h-full px-2.5 w-full outline-none bg-transparent text-foreground placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Store Creation */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                {/* Header */}
                <div className="text-center mb-6">
                  <motion.span 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-2 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-semibold px-3 py-1.5 rounded-full mb-4"
                  >
                     إعدادات المتجر
                  </motion.span>
                  <motion.h1 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-2xl sm:text-3xl font-bold text-foreground mb-2"
                  >
                    أخبرنا عن متجرك
                  </motion.h1>
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-sm text-muted-foreground max-w-sm mx-auto"
                  >
                    سيتم إنشاء متجرك باسم <span className="font-semibold text-foreground">@{formData.username || 'username'}</span>
                  </motion.p>
                </div>

                <div className="space-y-5">
                  {/* Category Selection - Grid with Icons */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      تصنيف المتجر <span className="text-red-500">*</span>
                    </label>
                    {/* More categories dropdown */}
                    {categoriesLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground mr-2">جاري تحميل التصنيفات...</span>
                      </div>
                    ) : (
                    <Select
                      value={storeData.category}
                      setValue={(value) => handleStoreChange('category', value as string)}
                      placeholder="📋 اختر تصنيف متجرك..."
                    >
                      {storeCategories.map((cat) => {
                        const Icon = getIconComponent(cat.icon);
                        return (
                          <SelectOption key={cat.id} value={cat.slug}>
                            <span className="flex items-center gap-2.5">
                              <Icon className="h-4.5 w-4.5" />
                              <span>{cat.nameAr}</span>
                            </span>
                          </SelectOption>
                        );
                      })}
                    </Select>
                    )}
                    {storeData.category && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-full"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {storeCategories.find(c => c.slug === storeData.category)?.nameAr}
                      </motion.div>
                    )}
                  </div>

                  {/* Employees Count - Horizontal pills */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      حجم النشاط <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(اختياري)</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {employeeOptions.map((option) => {
                        const isSelected = storeData.employeesCount === option.value;
                        return (
                          <motion.button
                            key={option.value}
                            type="button"
                            onClick={() => handleStoreChange('employeesCount', option.value)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-full border-2 transition-all duration-200 text-xs font-medium ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 shadow-sm'
                                : 'border-slate-300 dark:border-slate-600 hover:border-primary/50 text-slate-700 dark:text-slate-300 hover:bg-primary/5'
                            }`}
                          >
                            <span className="text-base">{option.emoji}</span>
                            <span>{option.label}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Store Description */}
                  <div className="space-y-2">
                    <label htmlFor="storeDescription" className="block text-sm font-medium text-foreground">
                      وصف المتجر <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(اختياري)</span>
                    </label>
                    <textarea
                      id="storeDescription"
                      placeholder="اكتب نبذة مختصرة عن متجرك..."
                      value={storeData.storeDescription}
                      onChange={(e) => handleStoreChange('storeDescription', e.target.value)}
                      disabled={loading}
                      rows={3}
                      maxLength={500}
                      className="w-full p-3 border-2 border-slate-300 dark:border-slate-600 rounded-2xl bg-background text-foreground placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 outline-none disabled:opacity-50 resize-none text-sm"
                    />
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 dark:text-slate-400">اكتب وصفاً جذاباً لمتجرك</span>
                      <span className={`font-medium ${
                        storeData.storeDescription.length > 450 
                          ? 'text-amber-600 dark:text-amber-400' 
                          : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {storeData.storeDescription.length}/500
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress Steps During Creation */}
          <AnimatePresence>
            {progressStep !== 'idle' && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="mt-6 p-4 bg-primary/5 border-2 border-primary/20 rounded-xl"
              >
                <div className="space-y-2.5">
                  {/* Creating Account Step */}
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3"
                  >
                    {progressStep === 'creating-account' ? (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    ) : (progressStep === 'creating-store' || progressStep === 'done') ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                    )}
                    <span className={`text-sm font-semibold ${
                      progressStep === 'creating-account' ? 'text-primary' : 
                      (progressStep === 'creating-store' || progressStep === 'done') ? 'text-foreground' : 
                      'text-slate-500'
                    }`}>
                      {progressStep === 'creating-account' ? 'جاري إنشاء الحساب...' : '✓ تم إنشاء الحساب'}
                    </span>
                  </motion.div>

                  {/* Creating Store Step */}
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-3"
                  >
                      {progressStep === 'creating-store' ? (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      ) : progressStep === 'done' ? (
                        storeCreationError ? (
                          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        )
                      ) : (
                        <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                      )}
                      <span className={`text-sm font-semibold ${
                        progressStep === 'creating-store' ? 'text-primary' : 
                        progressStep === 'done' && !storeCreationError ? 'text-foreground' : 
                        progressStep === 'done' && storeCreationError ? 'text-amber-600 dark:text-amber-400' :
                        'text-slate-500'
                      }`}>
                        {progressStep === 'creating-store' ? 'جاري إنشاء المتجر...' : 
                         progressStep === 'done' && !storeCreationError ? '✓ تم إنشاء المتجر' : 
                         progressStep === 'done' && storeCreationError ? 'تحذير: فشل إنشاء المتجر' :
                         'سيتم إنشاء المتجر'}
                      </span>
                    </motion.div>

                  {/* Done Step */}
                  {progressStep === 'done' && !storeCreationError && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-center gap-2 pt-3 mt-3 border-t border-primary/10"
                    >
                      <Sparkles className="h-5 w-5 text-emerald-600 animate-pulse" />
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        جاري التحويل...
                      </span>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Alert */}
          {displayError && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mt-5 p-3 bg-red-50 dark:bg-red-900/10 border-2 border-red-200 dark:border-red-800/30 rounded-xl flex items-start gap-2.5" 
              role="alert" 
              aria-live="polite"
            >
              <AlertTriangle className="h-4.5 w-4.5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-0.5">تنبيه</p>
                <p className="text-xs text-red-600 dark:text-red-400">{displayError}</p>
              </div>
            </motion.div>
          )}

          {/* Progress Indicator */}
          <div className="mt-8">
            <ProgressIndicator
              currentStep={currentStep}
              totalSteps={totalSteps}
              onBack={handleBack}
              onContinue={handleContinue}
              isLoading={loading}
              isBackVisible={currentStep > 1}
              disabled={loading || checking || !!rateLimitError}
              continueLabel="استمرار"
              backLabel="رجوع"
              finishLabel="إنشاء الحساب والمتجر"
            />
          </div>
        </form>

        {/* Footer */}
        <p className="text-[11px] text-muted-foreground/60 text-center mt-6">
          بإنشاء حسابك، أنت توافق على شروط الاستخدام وسياسة الخصوصية
        </p>
      </motion.div>
    </div>
  );
}

// Loading fallback component
function CompleteProfileLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">جاري التحميل...</p>
      </div>
    </div>
  );
}

// Main page component wrapped in Suspense
export default function CompleteProfilePage() {
  return (
    <Suspense fallback={<CompleteProfileLoading />}>
      <CompleteProfileContent />
    </Suspense>
  );
}
