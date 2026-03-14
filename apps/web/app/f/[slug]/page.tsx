'use client';

import { useState, useEffect, useMemo, useCallback, Fragment, ReactNode, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRecaptchaEnterprise, RecaptchaActions } from '@/lib/hooks/useRecaptchaEnterprise';
import {
  FileText,
  Send,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Calendar,
  Clock,
  Lock,
  Star,
  Upload,
  X,
  Share2,
  QrCode,
  Copy,
  Mail,
  Phone,
  Hash,
  ArrowRight,
  Info,
  User,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SignatureCanvas } from '@/components/ui/signature-canvas';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/utils';
import {
  useForms,
  Form,
  FormField,
  FieldType,
  FormStatus,
} from '@/lib/hooks/useForms';
import {
  useAdvancedFormFields,
  calculateFormula,
  formatCalculatedValue,
  getHiddenFieldValue,
} from '@/lib/hooks/useAdvancedFormFields';

// Form Theme Interface
interface FormTheme {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  accentColor: string;
  fontFamily: string;
  fontSize: 'small' | 'medium' | 'large';
  borderRadius: 'none' | 'small' | 'medium' | 'large' | 'full';
  fieldStyle: 'outlined' | 'filled' | 'underlined';
  spacing: 'compact' | 'normal' | 'relaxed';
  appearance: 'light' | 'dark' | 'system';
  showLogo: boolean;
  presetId?: string;
  // Background
  backgroundType?: 'solid' | 'gradient' | 'image' | 'video' | 'preset';
  backgroundImage?: string;
  backgroundVideo?: string;
  backgroundPreset?: string;
  backgroundGradient?: string;
  backgroundBlur?: number;
  backgroundOverlay?: number;
  backgroundFit?: 'cover' | 'contain' | 'fill';
  // Submit Button
  submitButton?: {
    shape: 'square' | 'rounded' | 'pill';
    color: string;
    textColor: string;
    text: string;
    fullWidth: boolean;
  };
  // Footer
  footer?: {
    show: boolean;
    text: string;
    showBranding: boolean;
  };
}

// Default theme
const DEFAULT_THEME: FormTheme = {
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
};

// Apply theme to CSS variables
const getThemeStyles = (theme: FormTheme): React.CSSProperties => {
  const fontFamilyMap: Record<string, string> = {
    default: 'inherit',
    cairo: '"Cairo", sans-serif',
    tajawal: '"Tajawal", sans-serif',
    almarai: '"Almarai", sans-serif',
    'ibm-plex': '"IBM Plex Sans Arabic", sans-serif',
    readex: '"Readex Pro", sans-serif',
    'noto-kufi': '"Noto Kufi Arabic", sans-serif',
    modern: '"IBM Plex Sans Arabic", "Rubik", sans-serif',
    classic: '"Noto Naskh Arabic", "Traditional Arabic", serif',
    playful: '"Changa", sans-serif',
  };
  
  const fontSizeMap: Record<string, string> = {
    small: '14px',
    medium: '16px',
    large: '18px',
  };
  
  const borderRadiusMap: Record<string, string> = {
    none: '0px',
    small: '8px',
    medium: '16px',
    large: '24px',
    full: '9999px',
  };
  
  const spacingMap: Record<string, string> = {
    compact: '12px',
    normal: '20px',
    relaxed: '28px',
  };

  return {
    '--form-primary': theme.primaryColor,
    '--form-bg': theme.backgroundColor,
    '--form-text': theme.textColor,
    '--form-border': theme.borderColor,
    '--form-accent': theme.accentColor,
    '--form-font': fontFamilyMap[theme.fontFamily] || 'inherit',
    '--form-font-size': fontSizeMap[theme.fontSize] || '16px',
    '--form-radius': borderRadiusMap[theme.borderRadius] || '16px',
    '--form-spacing': spacingMap[theme.spacing] || '20px',
    fontFamily: fontFamilyMap[theme.fontFamily] || 'inherit',
    fontSize: fontSizeMap[theme.fontSize] || '16px',
  } as React.CSSProperties;
};

// API Base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001';

// Helper functions
const getInitials = (name: string): string => {
  return name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
};

const getAvatarUrl = (avatar?: string | null): string | undefined => {
  if (!avatar) return undefined;
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('users/') || avatar.startsWith('profiles/')) {
    return `${API_BASE_URL}/api/${avatar}`;
  }
  return `${API_BASE_URL}/uploads/avatars/${avatar.split('/').pop()}`;
};

export default function PublicFormPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { getFormBySlug, submitForm } = useForms();
  const { executeRecaptcha } = useRecaptchaEnterprise();

  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showModal, setShowModal] = useState<'qr' | 'share' | null>(null);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showQrInSheet, setShowQrInSheet] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const infoSheetDragControls = useDragControls();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch form data
  useEffect(() => {
    const fetchForm = async () => {
      setLoading(true);
      try {
        const formData = await getFormBySlug(slug);
        if (formData) {
          setForm(formData);
          const initialResponses: Record<string, any> = {};
          formData.fields?.forEach((field) => {
            if (field.defaultValue) {
              initialResponses[field.id] = field.defaultValue;
            } else if (field.type === FieldType.CHECKBOX) {
              initialResponses[field.id] = [];
            } else if (field.type === FieldType.TOGGLE) {
              initialResponses[field.id] = false;
            }
          });
          setResponses(initialResponses);
        } else {
          setError('النموذج غير موجود');
        }
      } catch {
        setError('حدث خطأ أثناء تحميل النموذج');
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchForm();
  }, [slug, getFormBySlug]);

  const handleFieldChange = useCallback((fieldId: string, value: any) => {
    setResponses(prev => ({ ...prev, [fieldId]: value }));
    setValidationErrors(prev => {
      if (prev[fieldId]) {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      }
      return prev;
    });
  }, []);

  // Advanced form fields logic (conditional, calculated, hidden) - Must be before currentFields
  const {
    visibleFields: filteredByLogic,
    calculatedValues,
    formattedCalculatedValues,
    hiddenFieldValues,
    isFieldVisible,
    getCalculatedDisplay,
  } = useAdvancedFormFields({
    fields: (form?.fields || []) as any,
    responses,
    onResponseChange: handleFieldChange,
  });

  // Get current fields with conditional logic applied
  const currentFields = useMemo(() => {
    if (!form) return [];
    
    let fields: FormField[] = [];
    if (form.isMultiStep && form.steps?.length) {
      fields = form.steps[currentStep]?.fields || [];
    } else {
      fields = form.fields || [];
    }
    
    // Filter out hidden fields and apply conditional logic
    return fields.filter(field => {
      // Hidden fields are never shown but still processed
      if (field.type === FieldType.HIDDEN) return false;
      // Check conditional visibility
      return isFieldVisible(field.id);
    });
  }, [form, currentStep, isFieldVisible]);

  const totalSteps = form?.isMultiStep ? (form.steps?.length || 1) : 1;

  // Get form theme
  const formTheme = useMemo<FormTheme>(() => {
    if (form?.theme && typeof form.theme === 'object') {
      return { ...DEFAULT_THEME, ...(form.theme as Partial<FormTheme>) };
    }
    return DEFAULT_THEME;
  }, [form?.theme]);

  // Theme styles for the form
  const themeStyles = useMemo(() => getThemeStyles(formTheme), [formTheme]);

  // Progress
  const progress = useMemo(() => {
    if (!form?.fields?.length) return 0;
    const answered = form.fields.filter(f => 
      responses[f.id] !== undefined && responses[f.id] !== '' && responses[f.id] !== null
    );
    return Math.round((answered.length / form.fields.length) * 100);
  }, [form, responses]);

  // Validation
  const validateCurrentFields = (): boolean => {
    const errors: Record<string, string> = {};
    currentFields.forEach((field) => {
      if (field.required) {
        const value = responses[field.id];
        if (value === undefined || value === '' || value === null) {
          errors[field.id] = 'هذا الحقل مطلوب';
        } else if (field.type === FieldType.CHECKBOX && Array.isArray(value) && value.length === 0) {
          errors[field.id] = 'اختر خياراً واحداً على الأقل';
        }
      }
      if (field.type === FieldType.EMAIL && responses[field.id]) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(responses[field.id])) {
          errors[field.id] = 'بريد إلكتروني غير صالح';
        }
      }
      if (field.type === FieldType.PHONE && responses[field.id]) {
        if (!/^[\d\s\-+()]+$/.test(responses[field.id])) {
          errors[field.id] = 'رقم هاتف غير صالح';
        }
      }
    });
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentFields() && currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrentFields()) return;
    setIsSubmitting(true);
    try {
      // Execute reCAPTCHA Enterprise before form submission
      const recaptchaToken = await executeRecaptcha(RecaptchaActions.FORM_SUBMIT);
      
      // Submit form with reCAPTCHA token
      const result = await submitForm(slug, { 
        ...responses,
        recaptchaToken 
      });
      
      if (result) {
        setIsSubmitted(true);
      } else {
        setError('فشل في إرسال النموذج');
      }
    } catch (error: any) {
      // Form submission error
      if (error.message?.includes('reCAPTCHA')) {
        setError('فشل في التحقق الأمني. يرجى المحاولة مرة أخرى.');
      } else {
        setError('حدث خطأ أثناء الإرسال');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Field renderer
  const renderField = (field: FormField, index: number) => {
    const hasError = !!validationErrors[field.id];
    const value = responses[field.id];
    const fieldId = `field-${field.id}`;
    const descId = `${fieldId}-desc`;
    const errorId = `${fieldId}-error`;
    const ariaDescribedBy = [field.description ? descId : null, hasError ? errorId : null].filter(Boolean).join(' ') || undefined;

    // Field style based on theme
    const fieldStyleClasses = {
      outlined: "border bg-transparent",
      filled: "border-0 bg-muted/50",
      underlined: "border-0 border-b-2 rounded-none bg-transparent",
    };

    const inputClass = cn(
      "w-full min-h-[48px] h-12 px-4 transition-all duration-200 text-sm outline-none",
      "placeholder:text-muted-foreground/60",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:scale-[1.01]",
      fieldStyleClasses[formTheme.fieldStyle] || fieldStyleClasses.outlined,
      formTheme.fieldStyle !== 'underlined' && `rounded-2xl`,
      hasError
        ? "border-destructive/50 focus-visible:border-destructive focus-visible:ring-destructive/20"
        : "border-border hover:border-primary/40 focus-visible:ring-primary/20 focus-visible:border-primary/50"
    );

    // Apply theme colors via inline styles
    const inputStyle: React.CSSProperties = {
      borderColor: hasError ? undefined : formTheme.appearance !== 'system' ? formTheme.borderColor : undefined,
      borderRadius: formTheme.fieldStyle !== 'underlined' ? `var(--form-radius, 16px)` : undefined,
    };

    // Field label and description
    const fieldLabel = (
      <div className="space-y-1.5 mb-2">
        <Label
          htmlFor={field.type !== FieldType.RADIO && field.type !== FieldType.CHECKBOX && field.type !== FieldType.TOGGLE ? fieldId : undefined}
          className={cn("text-sm font-semibold", hasError ? "text-destructive" : "text-foreground")}
        >
          {field.label}
          {field.required && <span className="text-destructive mr-1">*</span>}
        </Label>
        {field.description && (
          <p id={descId} className="text-xs text-muted-foreground leading-relaxed">
            {field.description}
          </p>
        )}
      </div>
    );

    // Error message
    const errorMessage = hasError && (
      <p id={errorId} className="text-xs text-destructive flex items-center gap-1.5 mt-2" role="alert">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
        {validationErrors[field.id]}
      </p>
    );

    switch (field.type) {
      case FieldType.TEXT:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <input
              id={fieldId}
              type="text"
              value={value || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder || 'أدخل النص...'}
              className={inputClass}
              style={inputStyle}
              aria-invalid={hasError}
              aria-required={field.required}
              aria-describedby={ariaDescribedBy}
            />
            {errorMessage}
          </div>
        );

      case FieldType.TEXTAREA:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <textarea
              id={fieldId}
              value={value || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder || 'أدخل النص...'}
              rows={4}
              className={cn(inputClass, "h-auto min-h-[120px] max-h-48 py-3.5 resize-y leading-relaxed")}
              style={inputStyle}
              aria-invalid={hasError}
              aria-required={field.required}
              aria-describedby={ariaDescribedBy}
            />
            {errorMessage}
          </div>
        );

      case FieldType.EMAIL:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="relative">
              <Mail className={cn("absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 transition-colors", hasError ? "text-destructive/60" : "text-muted-foreground/50")} aria-hidden />
              <input
                id={fieldId}
                type="email"
                value={value || ''}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                placeholder={field.placeholder || 'example@email.com'}
                className={cn(inputClass, "pr-12")}
                style={inputStyle}
                dir="ltr"
                aria-invalid={hasError}
                aria-required={field.required}
                aria-describedby={ariaDescribedBy}
              />
            </div>
            {errorMessage}
          </div>
        );

      case FieldType.PHONE:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="relative">
              <Phone className={cn("absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 transition-colors", hasError ? "text-destructive/60" : "text-muted-foreground/50")} aria-hidden />
              <input
                id={fieldId}
                type="tel"
                value={value || ''}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                placeholder={field.placeholder || '+964 XXX XXX XXXX'}
                className={cn(inputClass, "pr-12")}
                style={inputStyle}
                dir="ltr"
                aria-invalid={hasError}
                aria-required={field.required}
                aria-describedby={ariaDescribedBy}
              />
            </div>
            {errorMessage}
          </div>
        );

      case FieldType.NUMBER:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="relative">
              <Hash className={cn("absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 transition-colors", hasError ? "text-destructive/60" : "text-muted-foreground/50")} aria-hidden />
              <input
                id={fieldId}
                type="number"
                value={value || ''}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                placeholder={field.placeholder || '0'}
                min={field.minValue}
                max={field.maxValue}
                className={cn(inputClass, "pr-12")}
                style={inputStyle}
                dir="ltr"
                aria-invalid={hasError}
                aria-required={field.required}
                aria-describedby={ariaDescribedBy}
              />
            </div>
            {errorMessage}
          </div>
        );

      case FieldType.DATE:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="relative">
              <Calendar className={cn("absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 transition-colors pointer-events-none z-[1]", hasError ? "text-destructive/60" : "text-muted-foreground/50")} aria-hidden />
              <input
                id={fieldId}
                type="date"
                value={value || ''}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                min={(field as any).minDate || undefined}
                max={(field as any).maxDate || undefined}
                className={cn(inputClass, "pr-12 text-right form-date-input")}
                style={inputStyle}
                aria-invalid={hasError}
                aria-required={field.required}
                aria-describedby={ariaDescribedBy}
              />
            </div>
            {field.placeholder && <p className="text-xs text-muted-foreground mt-1">{field.placeholder}</p>}
            {errorMessage}
          </div>
        );

      case FieldType.TIME:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="relative">
              <Clock className={cn("absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 transition-colors pointer-events-none z-[1]", hasError ? "text-destructive/60" : "text-muted-foreground/50")} aria-hidden />
              <input
                id={fieldId}
                type="time"
                value={value || ''}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                min={(field as any).minTime || undefined}
                max={(field as any).maxTime || undefined}
                className={cn(inputClass, "pr-12 text-right form-date-input")}
                style={inputStyle}
                aria-invalid={hasError}
                aria-required={field.required}
                aria-describedby={ariaDescribedBy}
              />
            </div>
            {errorMessage}
          </div>
        );

      case FieldType.DATETIME:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="relative">
              <Calendar className={cn("absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 transition-colors pointer-events-none z-[1]", hasError ? "text-destructive/60" : "text-muted-foreground/50")} aria-hidden />
              <input
                id={fieldId}
                type="datetime-local"
                value={value || ''}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                className={cn(inputClass, "pr-12 text-right form-date-input")}
                style={inputStyle}
                aria-invalid={hasError}
                aria-required={field.required}
                aria-describedby={ariaDescribedBy}
              />
            </div>
            {field.placeholder && <p className="text-xs text-muted-foreground mt-1">{field.placeholder}</p>}
            {errorMessage}
          </div>
        );

      case FieldType.SELECT:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <Select value={value || ''} onValueChange={(v) => handleFieldChange(field.id, v)}>
              <SelectTrigger
                id={fieldId}
                className={cn(
                  "w-full min-h-[48px] h-12 px-4 bg-muted/30 border rounded-2xl transition-all text-sm",
                  "focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 focus:border-primary/50",
                  hasError ? "border-destructive/50" : "border-border hover:border-border/80"
                )}
                style={inputStyle}
                aria-invalid={hasError}
                aria-required={field.required}
                aria-describedby={ariaDescribedBy}
              >
                <SelectValue placeholder={field.placeholder || 'اختر...'} />
              </SelectTrigger>
              <SelectContent>
                {(field.options || []).map((opt, i) => {
                  const optValue = typeof opt === 'string' ? opt : opt.value;
                  const optLabel = typeof opt === 'string' ? opt : opt.label;
                  return (
                    <SelectItem key={i} value={optValue}>{optLabel}</SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errorMessage}
          </div>
        );

      case FieldType.RADIO:
        return (
          <div className="space-y-1" role="group" aria-labelledby={`${fieldId}-label`} aria-describedby={ariaDescribedBy} aria-invalid={hasError} aria-required={field.required}>
            <div id={`${fieldId}-label`}>{fieldLabel}</div>
            <div className="space-y-2.5 mt-2">
              {(field.options || []).map((opt, i) => {
                const optValue = typeof opt === 'string' ? opt : opt.value;
                const optLabel = typeof opt === 'string' ? opt : opt.label;
                const isSelected = value === optValue;
                const optId = `${fieldId}-opt-${i}`;
                return (
                  <label
                    key={i}
                    htmlFor={optId}
                    className={cn(
                      "flex items-center gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all min-h-[52px]",
                      isSelected 
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                        : "border-border hover:border-primary/30 hover:bg-muted/30"
                    )}
                  >
                    <input
                      id={optId}
                      type="radio"
                      name={fieldId}
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => handleFieldChange(field.id, optValue)}
                      aria-describedby={ariaDescribedBy}
                    />
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    )}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm font-medium text-foreground">{optLabel}</span>
                  </label>
                );
              })}
            </div>
            {errorMessage}
          </div>
        );

      case FieldType.CHECKBOX: {
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-1" role="group" aria-labelledby={`${fieldId}-label`} aria-describedby={ariaDescribedBy} aria-invalid={hasError} aria-required={field.required}>
            <div id={`${fieldId}-label`}>{fieldLabel}</div>
            <div className="space-y-2.5 mt-2">
              {(field.options || []).map((opt, i) => {
                const optValue = typeof opt === 'string' ? opt : opt.value;
                const optLabel = typeof opt === 'string' ? opt : opt.label;
                const isSelected = selectedValues.includes(optValue);
                const optId = `${fieldId}-opt-${i}`;
                return (
                  <label
                    key={i}
                    htmlFor={optId}
                    className={cn(
                      "flex items-center gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all min-h-[52px]",
                      isSelected 
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                        : "border-border hover:border-primary/30 hover:bg-muted/30"
                    )}
                  >
                    <input
                      id={optId}
                      type="checkbox"
                      className="sr-only"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleFieldChange(field.id, [...selectedValues, optValue]);
                        } else {
                          handleFieldChange(field.id, selectedValues.filter((v: string) => v !== optValue));
                        }
                      }}
                    />
                    <div className={cn(
                      "w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-foreground">{optLabel}</span>
                  </label>
                );
              })}
            </div>
            {errorMessage}
          </div>
        );
      }

      case FieldType.TOGGLE:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="flex gap-3" role="radiogroup" aria-label={field.label}>
              {/* Yes Button */}
              <button
                type="button"
                onClick={() => handleFieldChange(field.id, true)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all font-medium text-sm",
                  value === true
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                )}
                role="radio"
                aria-checked={value === true}
              >
                <Check className={cn("w-5 h-5", value === true ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50")} />
                <span>نعم</span>
              </button>
              
              {/* No Button */}
              <button
                type="button"
                onClick={() => handleFieldChange(field.id, false)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all font-medium text-sm",
                  value === false
                    ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 ring-2 ring-red-500/20"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/20"
                )}
                role="radio"
                aria-checked={value === false}
              >
                <X className={cn("w-5 h-5", value === false ? "text-red-600 dark:text-red-400" : "text-muted-foreground/50")} />
                <span>لا</span>
              </button>
            </div>
            {errorMessage}
          </div>
        );

      case FieldType.RATING: {
        const minR = Math.min(field.minValue ?? 1, field.maxValue ?? 5);
        const maxR = Math.max(field.maxValue ?? 5, field.minValue ?? 1);
        const count = Math.max(1, maxR - minR + 1);
        const currentRating = value !== undefined && value !== '' && value !== null ? Number(value) : 0;
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div
              className="flex flex-wrap items-center gap-1.5 mt-2 p-3 bg-muted/30 rounded-2xl border border-border"
              role="group"
              aria-label={field.label}
              aria-describedby={ariaDescribedBy}
            >
              {Array.from({ length: count }).map((_, i) => {
                const starValue = minR + i;
                const isSelected = currentRating === starValue;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleFieldChange(field.id, starValue)}
                    className="p-1.5 rounded-xl hover:bg-muted transition-colors min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center"
                    aria-label={`${starValue} من ${minR} إلى ${maxR}`}
                    aria-pressed={isSelected}
                  >
                    <Star
                      className={cn(
                        "w-6 h-6 sm:w-7 sm:h-7 transition-colors",
                        currentRating >= starValue ? "fill-warning text-warning" : "text-muted-foreground/30"
                      )}
                    />
                  </button>
                );
              })}
              {currentRating >= minR && currentRating <= maxR && (
                <span className="text-sm font-medium text-muted-foreground mr-2">{currentRating}/{maxR}</span>
              )}
            </div>
            {errorMessage}
          </div>
        );
      }

      case FieldType.SCALE:
        const min = field.minValue || 0;
        const max = field.maxValue || 10;
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="space-y-3 mt-2" role="group" aria-label={field.label} aria-describedby={ariaDescribedBy}>
              <div className="flex justify-between text-xs font-medium text-muted-foreground px-1">
                <span>{field.minLabel || min}</span>
                <span>{field.maxLabel || max}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: max - min + 1 }).map((_, i) => {
                  const num = min + i;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleFieldChange(field.id, num)}
                      className={cn(
                        "flex-1 min-w-[36px] py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all min-h-[40px] sm:min-h-[48px]",
                        value === num 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "bg-muted/50 hover:bg-muted text-foreground border border-border"
                      )}
                      aria-pressed={value === num}
                      aria-label={String(num)}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>
            {errorMessage}
          </div>
        );

      case FieldType.FILE: {
        const allowedTypes = (field as any).allowedFileTypes as string[] | undefined;
        const accept = allowedTypes?.length && !allowedTypes.includes('*/*') ? allowedTypes.join(',') : undefined;
        const maxFiles = Math.min(20, Math.max(1, (field as any).maxFiles ?? 1));
        const maxSize = (field as any).maxFileSize ?? 10 * 1024 * 1024;
        const fileValue = Array.isArray(value) ? value : value ? [value] : [];
        return (
          <div className="space-y-1">
            {fieldLabel}
            <input
              type="file"
              ref={(el) => { fileInputRefs.current[field.id] = el; }}
              accept={accept}
              multiple={maxFiles > 1}
              className="sr-only"
              id={`${fieldId}-file`}
              aria-describedby={ariaDescribedBy}
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                if (files.length === 0) return;
                const trimmed = files.slice(0, maxFiles);
                const oversized = trimmed.some(f => f.size > maxSize);
                if (oversized) {
                  setValidationErrors(prev => ({ ...prev, [field.id]: `الحجم الأقصى للملف ${Math.round(maxSize / (1024 * 1024))} ميجابايت` }));
                  e.target.value = '';
                  return;
                }
                const toDataUrl = (f: File): Promise<string> => new Promise((res, rej) => {
                  const r = new FileReader();
                  r.onload = () => res(r.result as string);
                  r.onerror = rej;
                  r.readAsDataURL(f);
                });
                Promise.all(trimmed.map(toDataUrl)).then((urls) => {
                  handleFieldChange(field.id, maxFiles === 1 ? urls[0] : urls);
                  setValidationErrors(prev => { const next = { ...prev }; delete next[field.id]; return next; });
                }).catch(() => handleFieldChange(field.id, maxFiles === 1 ? '' : []));
                e.target.value = '';
              }}
            />
            <div
              className="border-2 border-dashed border-border rounded-2xl p-4 sm:p-8 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors min-h-[120px] sm:min-h-[140px] flex flex-col items-center justify-center cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label="رفع الملفات"
              aria-describedby={ariaDescribedBy}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).click()}
              onClick={() => fileInputRefs.current[field.id]?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium text-foreground mb-1">
                {fileValue.length ? `تم اختيار ${fileValue.length} ملف/ملفات` : 'اضغط لرفع الملفات'}
              </p>
              <p className="text-xs text-muted-foreground">
                {accept ? `الأنواع: ${accept}` : 'جميع الأنواع مقبولة'} — الحجم الأقصى {Math.round(maxSize / (1024 * 1024))} ميجابايت
              </p>
            </div>
            {errorMessage}
          </div>
        );
      }

      case FieldType.SIGNATURE:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <SignatureCanvas
              value={value as string}
              onChange={(dataUrl) => handleFieldChange(field.id, dataUrl)}
              color={(field as any).signaturePenColor ?? (field as any).signatureColor ?? '#0f172a'}
              lineWidth={Math.min(6, Math.max(1, (field as any).signaturePenWidth ?? (field as any).signatureWidth ?? 2))}
              height={150}
              className="w-full"
            />
            {errorMessage}
          </div>
        );

      // ==================== NEW FIELD TYPES ====================

      case FieldType.URL: {
        const allowedDomains = (field as any).allowedDomains?.split(',').map((d: string) => d.trim()).filter(Boolean) || [];
        const urlValue = (value || '') as string;
        const isValidDomain = allowedDomains.length === 0 || allowedDomains.some((domain: string) => {
          try {
            const url = new URL(urlValue);
            return url.hostname === domain || url.hostname.endsWith('.' + domain);
          } catch {
            return false;
          }
        });
        const showDomainError = urlValue && allowedDomains.length > 0 && !isValidDomain;
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="relative">
              <input
                id={fieldId}
                type="url"
                inputMode="url"
                value={urlValue}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                placeholder={field.placeholder || 'https://example.com'}
                className={cn(inputClass, "pl-10", showDomainError && "border-destructive/50")}
                dir="ltr"
                aria-invalid={hasError || !!showDomainError}
                aria-required={field.required}
                aria-describedby={ariaDescribedBy}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                🔗
              </span>
            </div>
            {showDomainError && (
              <p className="text-xs text-destructive">يجب أن يكون الرابط من: {allowedDomains.join('، ')}</p>
            )}
            {errorMessage}
          </div>
        );
      }

      case FieldType.MULTISELECT: {
        const multiselectOptions = Array.isArray(field.options) ? field.options : [];
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="space-y-2" role="group" aria-label={field.label} aria-describedby={ariaDescribedBy}>
              {multiselectOptions.map((option, i) => {
                const optionValue = typeof option === 'string' ? option : option.value;
                const optionLabel = typeof option === 'string' ? option : option.label;
                const isChecked = selectedValues.includes(optionValue);
                return (
                  <label
                    key={i}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all min-h-[52px]",
                      isChecked 
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        const newValue = isChecked
                          ? selectedValues.filter(v => v !== optionValue)
                          : [...selectedValues, optionValue];
                        handleFieldChange(field.id, newValue);
                      }}
                      className="w-5 h-5 rounded-md accent-primary"
                    />
                    <span className="text-sm font-medium text-foreground">{optionLabel}</span>
                  </label>
                );
              })}
            </div>
            {errorMessage}
          </div>
        );
      }

      case FieldType.RANKING:
        const rankingOptions = Array.isArray(field.options) ? field.options : [];
        const rankedItems = Array.isArray(value) ? value : rankingOptions.map(o => typeof o === 'string' ? o : o.value);
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="space-y-2" role="list" aria-label={field.label} aria-describedby={ariaDescribedBy}>
              {rankedItems.map((item, i) => {
                const itemLabel = typeof item === 'string' ? item : (rankingOptions.find(o => (typeof o === 'string' ? o : o.value) === item) as any)?.label || item;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-4 bg-muted/30 border border-border rounded-2xl min-h-[52px] cursor-move"
                    role="listitem"
                  >
                    <span className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-foreground flex-1">{itemLabel}</span>
                    <span className="text-muted-foreground/50">⋮⋮</span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">اسحب العناصر لترتيبها حسب الأفضلية</p>
            {errorMessage}
          </div>
        );

      // Layout blocks - Display only, no input
      case FieldType.HEADING:
        return (
          <div className="py-2">
            <h2 className="text-xl font-bold text-foreground">{field.label}</h2>
            {field.description && (
              <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
            )}
          </div>
        );

      case FieldType.TITLE:
        return (
          <div className="py-3">
            <h3 className="text-lg font-semibold text-foreground">{field.label}</h3>
            {field.description && (
              <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
            )}
          </div>
        );

      case FieldType.PARAGRAPH:
        return (
          <div className="py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">{field.label}</p>
          </div>
        );

      case FieldType.LABEL:
        return (
          <div className="py-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{field.label}</span>
          </div>
        );

      case FieldType.DIVIDER:
        return (
          <div className="py-4">
            <hr className="border-border" />
          </div>
        );

      // Embed blocks
      case FieldType.IMAGE:
        const imgUrl = (field as any).imageUrl || field.defaultValue || field.placeholder;
        const imgAlt = (field as any).imageAlt || field.label || 'صورة';
        const imgWidth = (field as any).imageWidth || 'full';
        const imgAlign = (field as any).imageAlign || 'center';
        const imgLink = (field as any).imageLink;
        
        const widthClass = imgWidth === 'full' ? 'w-full' : imgWidth === 'medium' ? 'w-2/3' : 'w-1/3';
        const alignClass = imgAlign === 'right' ? 'mr-0 ml-auto' : imgAlign === 'left' ? 'ml-0 mr-auto' : 'mx-auto';
        
        const imageElement = imgUrl ? (
          <img 
            src={imgUrl} 
            alt={imgAlt} 
            className={cn("rounded-2xl border border-border object-cover max-h-80", widthClass, alignClass)}
          />
        ) : (
          <div className={cn("h-48 bg-muted rounded-2xl border border-border flex items-center justify-center", widthClass, alignClass)}>
            <span className="text-muted-foreground">🖼️ صورة</span>
          </div>
        );
        
        return (
          <div className="py-2">
            {field.label && <p className="text-sm font-medium text-foreground mb-2">{field.label}</p>}
            {imgLink ? (
              <a href={imgLink} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition-opacity">
                {imageElement}
              </a>
            ) : imageElement}
            {field.description && (
              <p className="text-xs text-muted-foreground mt-2">{field.description}</p>
            )}
          </div>
        );

      case FieldType.VIDEO:
        const vidUrl = (field as any).videoUrl || field.defaultValue || field.placeholder;
        const vidSource = (field as any).videoSource || 'youtube';
        const vidAutoplay = (field as any).videoAutoplay || false;
        const vidControls = (field as any).videoControls !== false;
        const vidLoop = (field as any).videoLoop || false;
        
        // Convert YouTube/Vimeo URLs to embed URLs
        let embedVidUrl = vidUrl;
        if (vidUrl) {
          if (vidSource === 'youtube' || vidUrl.includes('youtube.com') || vidUrl.includes('youtu.be')) {
            const videoId = vidUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&\n?#]+)/)?.[1];
            if (videoId) {
              embedVidUrl = `https://www.youtube.com/embed/${videoId}?${vidAutoplay ? 'autoplay=1&' : ''}${vidLoop ? 'loop=1&playlist=' + videoId + '&' : ''}${!vidControls ? 'controls=0' : ''}`;
            }
          } else if (vidSource === 'vimeo' || vidUrl.includes('vimeo.com')) {
            const vimeoId = vidUrl.match(/vimeo\.com\/(\d+)/)?.[1];
            if (vimeoId) {
              embedVidUrl = `https://player.vimeo.com/video/${vimeoId}?${vidAutoplay ? 'autoplay=1&' : ''}${vidLoop ? 'loop=1&' : ''}`;
            }
          }
        }
        
        return (
          <div className="py-2">
            {field.label && <p className="text-sm font-medium text-foreground mb-2">{field.label}</p>}
            {embedVidUrl ? (
              vidSource === 'direct' ? (
                <video
                  src={vidUrl}
                  className="w-full rounded-2xl border border-border"
                  controls={vidControls}
                  autoPlay={vidAutoplay}
                  loop={vidLoop}
                  playsInline
                />
              ) : (
                <div className="aspect-video rounded-2xl overflow-hidden border border-border">
                  <iframe
                    src={embedVidUrl}
                    className="w-full h-full"
                    allowFullScreen
                    allow="autoplay; fullscreen; picture-in-picture"
                    title={field.label || 'فيديو'}
                  />
                </div>
              )
            ) : (
              <div className="aspect-video bg-muted rounded-2xl border border-border flex items-center justify-center">
                <span className="text-muted-foreground">🎬 فيديو</span>
              </div>
            )}
            {field.description && (
              <p className="text-xs text-muted-foreground mt-2">{field.description}</p>
            )}
          </div>
        );

      case FieldType.AUDIO:
        const audUrl = (field as any).audioUrl || field.defaultValue || field.placeholder;
        const audAutoplay = (field as any).audioAutoplay || false;
        const audControls = (field as any).audioControls !== false;
        
        return (
          <div className="py-2">
            {field.label && <p className="text-sm font-medium text-foreground mb-2">{field.label}</p>}
            {audUrl ? (
              <audio 
                controls={audControls} 
                autoPlay={audAutoplay}
                className="w-full rounded-xl"
              >
                <source src={audUrl} />
                متصفحك لا يدعم تشغيل الصوت
              </audio>
            ) : (
              <div className="h-16 bg-muted rounded-2xl border border-border flex items-center justify-center">
                <span className="text-muted-foreground">🔊 ملف صوتي</span>
              </div>
            )}
            {field.description && (
              <p className="text-xs text-muted-foreground mt-2">{field.description}</p>
            )}
          </div>
        );

      case FieldType.EMBED:
        const embCode = (field as any).embedCode;
        const embHeight = (field as any).embedHeight || 400;
        const embUrl = field.defaultValue || field.placeholder;
        
        return (
          <div className="py-2">
            {field.label && <p className="text-sm font-medium text-foreground mb-2">{field.label}</p>}
            {embCode ? (
              <div 
                className="rounded-2xl overflow-hidden border border-border"
                style={{ height: embHeight }}
                dangerouslySetInnerHTML={{ __html: embCode }}
              />
            ) : embUrl ? (
              <div 
                className="rounded-2xl overflow-hidden border border-border"
                style={{ height: embHeight }}
              >
                <iframe
                  src={embUrl}
                  className="w-full h-full"
                  title={field.label || 'محتوى مضمن'}
                />
              </div>
            ) : (
              <div 
                className="bg-muted rounded-2xl border border-border flex items-center justify-center"
                style={{ height: embHeight }}
              >
                <span className="text-muted-foreground">📦 محتوى مضمن</span>
              </div>
            )}
            {field.description && (
              <p className="text-xs text-muted-foreground mt-2">{field.description}</p>
            )}
          </div>
        );

      // Advanced blocks
      case FieldType.HIDDEN:
        // Hidden fields are not rendered
        return null;

      case FieldType.CALCULATED:
        const calculatedDisplay = getCalculatedDisplay(field.id);
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl min-h-[52px] flex items-center">
              <span className="text-lg font-bold text-primary">{calculatedDisplay}</span>
            </div>
          </div>
        );

      case FieldType.RECAPTCHA:
        // reCAPTCHA Enterprise - يتم التعامل معها في handleSubmit
        return (
          <div className="py-4 flex flex-col items-center justify-center gap-3">
            {field.label && field.label !== 'حماية reCAPTCHA' && (
              <p className="text-sm font-medium text-foreground">{field.label}</p>
            )}
            
            {/* Enterprise reCAPTCHA Visual Indicator */}
            <div className="p-6 bg-gradient-to-br from-emerald-50 to-green-100/50 dark:from-emerald-900/20 dark:to-green-900/10 rounded-2xl border border-emerald-200/50 dark:border-emerald-700/30 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">محمي بتقنية Google reCAPTCHA Enterprise</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500">حماية متقدمة من البوتات والسبام</p>
              </div>
            </div>
            
            {hasError && (
              <p className="text-xs text-destructive">فشل في التحقق من الحماية، يرجى المحاولة مرة أخرى</p>
            )}
          </div>
        );

      case FieldType.CONDITIONAL_LOGIC:
        // This is a logic block, not a visible field
        return null;

      case FieldType.MATRIX: {
        const matrixRows = (field as any).matrixRows || [];
        const matrixColumns = (field as any).matrixColumns || [];
        const matrixValue = (value || {}) as Record<string, string>;
        
        if (matrixRows.length === 0 || matrixColumns.length === 0) {
          return (
            <div className="space-y-1">
              {fieldLabel}
              <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-xl text-center">
                لم يتم إعداد الجدول بعد
              </div>
            </div>
          );
        }
        
        return (
          <div className="space-y-2">
            {fieldLabel}
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full border-collapse min-w-[400px]">
                <thead>
                  <tr>
                    <th className="p-2 text-right text-xs font-medium text-muted-foreground bg-muted/30 rounded-tr-lg"></th>
                    {matrixColumns.map((col: string, i: number) => (
                      <th key={i} className="p-2 text-center text-xs font-medium text-muted-foreground bg-muted/30 last:rounded-tl-lg">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((row: string, rowIndex: number) => (
                    <tr key={rowIndex} className="border-b border-border/50 last:border-0">
                      <td className="p-3 text-sm font-medium text-foreground bg-muted/10">
                        {row}
                      </td>
                      {matrixColumns.map((col: string, colIndex: number) => (
                        <td key={colIndex} className="p-2 text-center">
                          <label className="cursor-pointer flex items-center justify-center">
                            <input
                              type="radio"
                              name={`matrix-${field.id}-${rowIndex}`}
                              checked={matrixValue[row] === col}
                              onChange={() => {
                                handleFieldChange(field.id, { ...matrixValue, [row]: col });
                              }}
                              className="w-4 h-4 accent-primary cursor-pointer"
                            />
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errorMessage}
          </div>
        );
      }

      default:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <input
              id={fieldId}
              type="text"
              value={value || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder || 'أدخل البيانات...'}
              className={inputClass}
              aria-invalid={hasError}
              aria-required={field.required}
              aria-describedby={ariaDescribedBy}
            />
            {errorMessage}
          </div>
        );
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
          <div className="flex items-center">
            <img src="/ruknylogo.svg" alt="Rukny" className="h-20 w-auto" />
          </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">جاري التحميل</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !form) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 bg-destructive/10 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">النموذج غير موجود</h1>
          <p className="text-sm text-muted-foreground mb-6">{error || 'لم نتمكن من العثور على هذا النموذج'}</p>
          <a href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95">
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </a>
        </motion.div>
      </div>
    );
  }

  // Closed state
  if (form.status !== FormStatus.PUBLISHED) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 bg-warning/10 rounded-3xl flex items-center justify-center mx-auto mb-5">
            <Lock className="w-10 h-10 text-warning" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">النموذج مغلق</h1>
          <p className="text-sm text-muted-foreground mb-6">هذا النموذج لا يقبل إجابات جديدة</p>
          <a href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95">
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </a>
        </motion.div>
      </div>
    );
  }

  // Success state
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="text-center max-w-md"
        >
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 15, stiffness: 200 }}
            className="w-20 h-20 bg-success/10 rounded-3xl flex items-center justify-center mx-auto mb-5"
          >
            <Check className="w-10 h-10 text-success" />
          </motion.div>
          <h1 className="text-2xl font-bold text-foreground mb-2">تم الإرسال بنجاح!</h1>
          <p className="text-sm text-muted-foreground mb-6">شكراً لمشاركتك في "{form.title}"</p>
          {form.autoResponseMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card border border-border/60 rounded-2xl p-4 text-right mb-6"
            >
              <p className="text-sm text-foreground leading-relaxed">{form.autoResponseMessage}</p>
            </motion.div>
          )}
          <a href="/" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95">
            <ArrowRight className="w-4 h-4" />
            العودة للرئيسية
          </a>
        </motion.div>
      </div>
    );
  }

  const formUrl = typeof window !== 'undefined' ? window.location.href : '';
  const ownerName = form.user?.profile?.name || form.user?.email?.split('@')[0] || 'مستخدم';

  // حساب أنماط الخلفية بناءً على نوع الخلفية
  const getBackgroundStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      ...themeStyles,
      color: formTheme.appearance !== 'system' ? formTheme.textColor : undefined,
    };

    switch (formTheme.backgroundType) {
      case 'image':
        if (formTheme.backgroundImage) {
          return {
            ...baseStyles,
            backgroundImage: `url(${formTheme.backgroundImage})`,
            backgroundSize: formTheme.backgroundFit === 'contain' ? 'contain' : formTheme.backgroundFit === 'fill' ? '100% 100%' : 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
            backgroundColor: formTheme.backgroundFit === 'contain' ? '#000' : undefined,
          };
        }
        return { ...baseStyles, backgroundColor: formTheme.backgroundColor };
      case 'video':
        return { ...baseStyles };
      case 'gradient':
      case 'preset':
        if (formTheme.backgroundGradient) {
          return {
            ...baseStyles,
            background: formTheme.backgroundGradient,
          };
        }
        return { ...baseStyles, backgroundColor: formTheme.backgroundColor };
      case 'solid':
      default:
        return {
          ...baseStyles,
          backgroundColor: formTheme.appearance !== 'system' ? formTheme.backgroundColor : undefined,
        };
    }
  };

  const backgroundStyles = getBackgroundStyles();
  const hasBackgroundMedia = (formTheme.backgroundType === 'image' && formTheme.backgroundImage) ||
    (formTheme.backgroundType === 'video' && formTheme.backgroundVideo) ||
    formTheme.backgroundType === 'preset' ||
    formTheme.backgroundType === 'gradient';

  // Glass styles for elements when background media is present
  const glassCard = hasBackgroundMedia
    ? 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-white/30 dark:border-white/10'
    : 'bg-card border-border';
  const glassHeader = hasBackgroundMedia
    ? 'bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-white/30 dark:border-white/10'
    : 'bg-card/95 backdrop-blur-xl border-border/60';

  // Submit button styles
  const getSubmitButtonStyles = (): React.CSSProperties => {
    const btn = formTheme.submitButton;
    if (!btn) return {};
    return {
      backgroundColor: btn.color,
      color: btn.textColor,
      borderRadius: btn.shape === 'square' ? '4px' : btn.shape === 'pill' ? '9999px' : '12px',
    };
  };

  const submitButtonText = formTheme.submitButton?.text || 'إرسال';
  const submitButtonFullWidth = formTheme.submitButton?.fullWidth ?? false;

  return (
    <div 
      className={cn(
        "min-h-screen transition-colors relative overflow-x-hidden",
        formTheme.appearance === 'dark' ? 'dark bg-gray-900' : 
        formTheme.appearance === 'light' ? 'bg-white' : 'bg-background'
      )}
      dir="rtl"
      style={backgroundStyles}
    >
      {/* Video background */}
      {formTheme.backgroundType === 'video' && formTheme.backgroundVideo && (
        <video
          className={cn(
            "fixed inset-0 z-0",
            formTheme.backgroundFit === 'contain'
              ? "w-full h-full object-contain bg-black"
              : formTheme.backgroundFit === 'fill'
                ? "w-full h-full object-fill"
                : "w-full h-full object-cover"
          )}
          src={formTheme.backgroundVideo}
          autoPlay
          muted
          loop
          playsInline
          style={{
            filter: formTheme.backgroundBlur ? `blur(${formTheme.backgroundBlur}px)` : undefined,
            transform: formTheme.backgroundBlur ? 'scale(1.1)' : undefined,
          }}
        />
      )}

      {/* Blur layer for background image */}
      {formTheme.backgroundType === 'image' && formTheme.backgroundImage && formTheme.backgroundBlur && formTheme.backgroundBlur > 0 && (
        <div 
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: `url(${formTheme.backgroundImage})`,
            backgroundSize: formTheme.backgroundFit === 'contain' ? 'contain' : formTheme.backgroundFit === 'fill' ? '100% 100%' : 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundColor: formTheme.backgroundFit === 'contain' ? '#000' : undefined,
            filter: `blur(${formTheme.backgroundBlur}px)`,
            transform: 'scale(1.1)',
          }}
        />
      )}
      
      {/* Dark overlay for readability */}
      {hasBackgroundMedia && formTheme.backgroundOverlay && formTheme.backgroundOverlay > 0 && (
        <div 
          className="fixed inset-0 z-[1]"
          style={{
            backgroundColor: `rgba(0,0,0,${formTheme.backgroundOverlay / 100})`,
          }}
        />
      )}
      
      {/* Simple Header + بطاقة المعلومات تنبثق من هنا */}
      <header className="sticky top-2 z-10 mx-4 sm:mx-auto max-w-2xl relative">
        <div className={cn("rounded-4xl border px-4 py-3 flex items-center justify-between gap-3 transition-all duration-300", glassHeader)}>
          {/* Logo */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <img src="/ruknylogo.svg" alt="Rukny" className="h-12 w-auto flex-shrink-0" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setShowInfoSheet(!showInfoSheet)}
              className={cn(
                "w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200",
                showInfoSheet 
                  ? "bg-primary/15 text-primary scale-95" 
                  : "hover:bg-muted text-muted-foreground hover:scale-105 active:scale-95"
              )}
              aria-label="معلومات"
              aria-expanded={showInfoSheet}
            >
              <Info className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowModal('share')}
              className="w-9 h-9 flex items-center justify-center hover:bg-muted rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95"
              aria-label="مشاركة"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowModal('qr')}
              className="w-9 h-9 flex items-center justify-center hover:bg-muted rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95"
              aria-label="QR Code"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* بطاقة المعلومات — نفس التصميم المرجعي: إطار أبيض، محتوى أخضر غامق، خلفية مُموّهة */}
        <AnimatePresence onExitComplete={() => setShowQrInSheet(false)}>
          {showInfoSheet && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-transparent"
                onClick={() => setShowInfoSheet(false)}
                aria-hidden
              />
              <motion.div
                drag={isMobile ? "y" : false}
                dragControls={isMobile ? infoSheetDragControls : undefined}
                dragConstraints={isMobile ? { top: 0, bottom: 0 } : undefined}
                dragElastic={isMobile ? { top: 0, bottom: 0.25 } : undefined}
                dragMomentum={false}
                onDragEnd={isMobile ? (_, { offset, velocity }) => {
                  if (offset.y > 50 || velocity.y > 200) setShowInfoSheet(false);
                } : undefined}
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                className="absolute top-full left-0 right-0 sm:left-auto sm:right-0 sm:w-[340px] mt-2 z-50 rounded-4xl overflow-hidden bg-card border border-border/60 backdrop-blur-xl"
              >
                {/* شريط علوي: زر رجوع دائري أبيض + حبة خضراء (مثل المرجع) */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                  <button
                    onClick={() => setShowInfoSheet(false)}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-card border border-border text-muted-foreground hover:bg-muted transition-all duration-200 flex-shrink-0 hover:scale-105 active:scale-95"
                    aria-label="إغلاق"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <span className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    معلومات النموذج
                  </span>
                </div>

                {/* صورة النموذج — منفصلة عن المعلومات */}
                {form.bannerImages && form.bannerImages.length > 0 && (
                  <div className="mx-4 mb-3 relative">
                    <div className="rounded-4xl overflow-hidden aspect-video bg-muted relative group">
                      <AnimatePresence mode="wait">
                        <motion.img
                          key={currentBannerIndex}
                          src={form.bannerImages[currentBannerIndex]}
                          alt={`${form.title} - ${currentBannerIndex + 1}`}
                          className="w-full h-full object-cover"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        />
                      </AnimatePresence>
                      
                      {/* Navigation Arrows */}
                      {form.bannerImages.length > 1 && (
                        <>
                          <button
                            onClick={() => setCurrentBannerIndex((prev) => 
                              prev === 0 ? form.bannerImages!.length - 1 : prev - 1
                            )}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                            aria-label="الصورة السابقة"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setCurrentBannerIndex((prev) => 
                              prev === form.bannerImages!.length - 1 ? 0 : prev + 1
                            )}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                            aria-label="الصورة التالية"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                    
                    {/* Dots Indicator */}
                    {form.bannerImages.length > 1 && (
                      <div className="flex justify-center gap-1.5 mt-2">
                        {form.bannerImages.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => setCurrentBannerIndex(index)}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full transition-all duration-300",
                              index === currentBannerIndex 
                                ? "bg-primary w-6" 
                                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                            )}
                            aria-label={`الصورة ${index + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* المحتوى الرئيسي — خلفية primary */}
                <div className="mx-4 mb-4 rounded-4xl overflow-hidden bg-primary">
                  <div className="p-4 space-y-4">
                    {form.description && (
                      <p className="text-primary-foreground text-base leading-relaxed line-clamp-3">
                        {form.description}
                      </p>
                    )}
                    <p className="text-primary-foreground/70 text-sm">
                      {form.title} — ركني
                    </p>

                    {/* اسم المنشئ + توثيق + زر الملف الشخصي */}
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <Avatar className="w-10 h-10 rounded-full ring-2 ring-primary-foreground/30">
                          {form.user?.profile?.avatar && (
                            <AvatarImage src={getAvatarUrl(form.user.profile.avatar)} alt={ownerName} />
                          )}
                          <AvatarFallback className="bg-primary-foreground/20 text-primary-foreground text-sm rounded-full">
                            {getInitials(ownerName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary-foreground rounded-full border-2 border-primary flex items-center justify-center" title="موثق">
                          <Check className="w-2.5 h-2.5 text-primary" strokeWidth={2.5} />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-primary-foreground font-medium truncate">{ownerName}</p>
                        <span className="text-primary-foreground/70 text-xs">موثق</span>
                      </div>
                      {form.user?.profile?.username && (
                        <Link
                          href={`/${form.user.profile.username}`}
                          className="w-9 h-9 rounded-full flex items-center justify-center bg-primary-foreground/15 text-primary-foreground border border-primary-foreground/30 hover:bg-primary-foreground/25 transition-all duration-200 flex-shrink-0 hover:scale-105 active:scale-95"
                          title="عرض الملف الشخصي"
                          aria-label="عرض الملف الشخصي"
                        >
                          <User className="w-4 h-4" />
                        </Link>
                      )}
                    </div>

                    {/* الرابط */}
                    <a
                      href={formUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-primary-foreground/70 text-sm truncate hover:text-primary-foreground transition-colors"
                    >
                      {formUrl}
                    </a>
                  </div>
                </div>

                {/* مقبض سحب في الأسفل - فقط على الهاتف */}
                {isMobile && (
                  <div
                    className="py-2 flex justify-center cursor-grab active:cursor-grabbing touch-none border-t border-border"
                    onPointerDown={(e) => infoSheetDragControls.start(e)}
                    aria-hidden
                  >
                    <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-6 relative z-[2]">
        {/* Cover Image - Carousel للصور المتعددة */}
        {form.bannerImages && form.bannerImages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6 relative"
          >
            <div className="rounded-4xl border border-border/60 overflow-hidden relative group">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentBannerIndex}
                  src={form.bannerImages[currentBannerIndex]}
                  alt={`${form.title} - ${currentBannerIndex + 1}`}
                  className="w-full h-48 sm:h-56 object-cover"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                />
              </AnimatePresence>
              
              {/* Navigation Arrows - ظهور عند Hover على الكمبيوتر */}
              {form.bannerImages.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentBannerIndex((prev) => 
                      prev === 0 ? form.bannerImages!.length - 1 : prev - 1
                    )}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                    aria-label="الصورة السابقة"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => setCurrentBannerIndex((prev) => 
                      prev === form.bannerImages!.length - 1 ? 0 : prev + 1
                    )}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                    aria-label="الصورة التالية"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  
                  {/* Counter Badge */}
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
                    {currentBannerIndex + 1} / {form.bannerImages.length}
                  </div>
                </>
              )}
            </div>
            
            {/* Dots Indicator */}
            {form.bannerImages.length > 1 && (
              <div className="flex justify-center gap-2 mt-3">
                {form.bannerImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentBannerIndex(index)}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      index === currentBannerIndex 
                        ? "bg-primary w-8" 
                        : "bg-muted-foreground/30 hover:bg-muted-foreground/50 w-2"
                    )}
                    aria-label={`انتقل إلى الصورة ${index + 1}`}
                  />
                ))}
              </div>
            )}
            
            {/* Thumbnail Grid - للصور المتعددة */}
            {form.bannerImages.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                {form.bannerImages.slice(0, 6).map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentBannerIndex(index)}
                    className={cn(
                      "relative aspect-video rounded-lg overflow-hidden border-2 transition-all duration-200",
                      index === currentBannerIndex
                        ? "border-primary ring-2 ring-primary/20 scale-105"
                        : "border-border/60 hover:border-primary/50 opacity-60 hover:opacity-100"
                    )}
                  >
                    <img
                      src={image}
                      alt={`صورة مصغرة ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {index === currentBannerIndex && (
                      <div className="absolute inset-0 bg-primary/10" />
                    )}
                  </button>
                ))}
                {form.bannerImages.length > 6 && (
                  <div className="relative aspect-video rounded-lg overflow-hidden border-2 border-border/60 bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                    +{form.bannerImages.length - 6}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Form Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("rounded-4xl border p-5 mb-6", glassCard)}
        >
          {/* Owner */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
            <Avatar className="w-10 h-10 flex-shrink-0">
              {form.user?.profile?.avatar && (
                <AvatarImage src={getAvatarUrl(form.user.profile.avatar)} alt={ownerName} />
              )}
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {getInitials(ownerName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{ownerName}</p>
              <p className="text-xs text-muted-foreground">منشئ النموذج</p>
            </div>
            {form.user?.profile?.username && (
              <Link
                href={`/${form.user.profile.username}`}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all duration-200 flex-shrink-0 hover:scale-105 active:scale-95"
                title="عرض الملف الشخصي"
                aria-label="عرض الملف الشخصي"
              >
                <User className="w-4 h-4" />
              </Link>
            )}
          </div>

          {/* Title & Description */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{form.title}</h1>
              {form.description && (
                <p className="text-sm text-muted-foreground mt-1">{form.description}</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Multi-step indicator */}
        {form.isMultiStep && form.steps && form.steps.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="mb-6"
          >
            <div className="flex gap-1.5 mb-3">
              {form.steps.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex-1 h-1.5 rounded-full transition-all duration-300",
                    index <= currentStep ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>
            <div className="bg-card rounded-2xl border border-border/60 p-4 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-sm font-semibold">
                  {currentStep + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{form.steps[currentStep].title}</p>
                  {form.steps[currentStep].description && (
                    <p className="text-xs text-muted-foreground">{form.steps[currentStep].description}</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Form Fields */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className={cn("rounded-4xl border transition-all duration-300", glassCard)}
          style={{
            borderRadius: `var(--form-radius, 24px)`,
          }}
        >
          <div className="p-5" style={{ gap: `var(--form-spacing, 20px)`, display: 'flex', flexDirection: 'column' }}>
            {currentFields.map((field, index) => (
              <Fragment key={field.id}>{renderField(field, index)}</Fragment>
            ))}
          </div>

          {/* Actions */}
          <div className="p-5 border-t border-border flex items-center justify-between gap-3">
            {form.isMultiStep && currentStep > 0 ? (
              <button
                onClick={handlePrevious}
                className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <ChevronRight className="w-4 h-4" />
                السابق
              </button>
            ) : (
              <div />
            )}

            {form.isMultiStep && currentStep < totalSteps - 1 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                style={{
                  backgroundColor: formTheme.primaryColor,
                  borderRadius: `var(--form-radius, 12px)`,
                }}
              >
                التالي
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className={cn(
                  "flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 min-h-[44px]",
                  submitButtonFullWidth && "w-full"
                )}
                style={getSubmitButtonStyles()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                    جاري الإرسال...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    {submitButtonText}
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>

        {/* Footer */}
        {formTheme.footer?.show !== false && (
        <footer className={cn("mt-8 pt-6 border-t", hasBackgroundMedia ? 'border-white/20' : 'border-border')}>
          {formTheme.footer?.text && (
            <p className="text-center text-sm text-muted-foreground mb-3">
              {formTheme.footer.text}
            </p>
          )}
          {formTheme.footer?.showBranding !== false && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center">
            <span className="text-xs text-muted-foreground">مدعوم من</span>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors hover:underline underline-offset-2"
            >
              ركني
            </a>
          </div>
          )}
          {formTheme.footer?.showBranding !== false && (
          <p className="text-center text-xs text-muted-foreground/70 mt-2">
            © {new Date().getFullYear()} Rukny
          </p>
          )}
        </footer>
        )}
      </main>

      {/* QR Modal */}
      <AnimatePresence>
        {showModal === 'qr' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-3xl p-6 max-w-xs w-full border border-border/60"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">QR Code</h3>
                <button onClick={() => setShowModal(null)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110 active:scale-95">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex justify-center p-6 bg-gradient-to-br from-muted/50 to-muted rounded-2xl">
                <QRCodeSVG value={formUrl} size={180} />
              </div>
              <p className="text-center text-sm text-muted-foreground mt-4">امسح للوصول للنموذج</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {showModal === 'share' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-3xl p-6 max-w-sm w-full border border-border/60"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-lg">مشاركة النموذج</h3>
                <button onClick={() => setShowModal(null)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110 active:scale-95">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Copy Link */}
              <div className="flex items-center gap-2 p-3 bg-gradient-to-br from-muted/50 to-muted rounded-xl mb-4">
                <input
                  type="text"
                  value={formUrl}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-foreground outline-none truncate"
                  dir="ltr"
                />
                <button
                  onClick={handleCopyLink}
                  className={cn(
                    "p-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95",
                    copied 
                      ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
                      : "bg-background hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Share Buttons */}
              <div className="grid grid-cols-4 gap-3 mt-6">
                {/* WhatsApp */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(form.title + ' ' + formUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-all duration-200 hover:scale-105 active:scale-95 group"
                >
                  <div className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <span className="text-xs text-muted-foreground">واتساب</span>
                </a>

                {/* X (Twitter) */}
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(formUrl)}&text=${encodeURIComponent(form.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-all duration-200 hover:scale-105 active:scale-95 group"
                >
                  <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <span className="text-xs text-muted-foreground">X</span>
                </a>

                {/* Telegram */}
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(formUrl)}&text=${encodeURIComponent(form.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-all duration-200 hover:scale-105 active:scale-95 group"
                >
                  <div className="w-12 h-12 bg-[#0088cc] rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                  </div>
                  <span className="text-xs text-muted-foreground">تيليجرام</span>
                </a>

                {/* Email */}
                <a
                  href={`mailto:?subject=${encodeURIComponent(form.title)}&body=${encodeURIComponent(formUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted transition-all duration-200 hover:scale-105 active:scale-95 group"
                >
                  <div className="w-12 h-12 bg-muted-foreground rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110">
                    <Mail className="w-5 h-5 text-background" />
                  </div>
                  <span className="text-xs text-muted-foreground">بريد</span>
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}