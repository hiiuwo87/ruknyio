'use client';

import { useMemo, useState, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/components/toast-provider';
import {
  FileText,
  Mail,
  Phone,
  Hash,
  Calendar,
  Clock,
  Upload,
  Star,
  PenTool,
  Send,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
  Share2,
  Copy,
  Info,
  User,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldType } from '@/lib/hooks/useForms';
import { type FormFieldInput } from './FieldEditor';
import { type FormStepInput } from './StepEditor';
import { type FormTheme, DEFAULT_THEME } from './FormThemeCustomizer';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/providers/auth-provider';

// ============================================
// Types
// ============================================

export interface FormPreviewData {
  title: string;
  description?: string;
  fields: FormFieldInput[];
  isMultiStep: boolean;
  steps: FormStepInput[];
  theme: FormTheme;
  bannerUrl?: string;
  allowMultipleSubmissions: boolean;
  requiresAuthentication: boolean;
  showProgressBar: boolean;
  showQuestionNumbers: boolean;
}

interface FormFullPreviewProps {
  data: FormPreviewData;
  onClose?: () => void;
  formUrl?: string | null;
  formSlug?: string;
}

// ============================================
// Theme Styles Helper
// ============================================

const getThemeStyles = (theme: FormTheme): React.CSSProperties => {
  const fontFamilyMap: Record<string, string> = {
    default: 'inherit',
    modern: '"IBM Plex Sans Arabic", "Rubik", sans-serif',
    classic: '"Noto Naskh Arabic", "Traditional Arabic", serif',
    playful: '"Comic Sans MS", "Changa", sans-serif',
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
    '--form-spacing': spacingMap[(theme as any).spacing] || '20px',
    fontFamily: fontFamilyMap[theme.fontFamily] || 'inherit',
    fontSize: fontSizeMap[theme.fontSize] || '16px',
  } as React.CSSProperties;
};

// ============================================
// Main Component — matches /f/[slug] design
// ============================================

export function FormFullPreview({ data, onClose, formUrl }: FormFullPreviewProps) {
  const {
    title,
    description,
    fields,
    isMultiStep,
    steps,
    theme,
    bannerUrl,
    showProgressBar,
    showQuestionNumbers,
  } = data;

  const { user } = useAuth();
  const themeStyles = useMemo(() => getThemeStyles(theme), [theme]);
  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  const [showModal, setShowModal] = useState<'share' | null>(null);
  const [copied, setCopied] = useState(false);

  const ownerName = user?.name || user?.email?.split('@')[0] || 'مستخدم';

  // Get current fields
  const currentFields = useMemo(() => {
    if (isMultiStep && steps.length > 0) {
      return steps[currentStep]?.fields || [];
    }
    return fields;
  }, [isMultiStep, steps, fields, currentStep]);

  const totalSteps = isMultiStep ? steps.length : 1;

  // Handle field value change
  const handleFieldChange = (fieldId: string, value: any) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }));
    setValidationErrors(prev => {
      if (prev[fieldId]) {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      }
      return prev;
    });
  };

  // Copy link
  const handleCopyLink = () => {
    if (!formUrl) return;
    navigator.clipboard.writeText(formUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Validate
  const validateCurrentFields = (): boolean => {
    const errors: Record<string, string> = {};
    currentFields.forEach((field) => {
      if (field.required) {
        const value = formValues[field.id];
        if (value === undefined || value === '' || value === null) {
          errors[field.id] = 'هذا الحقل مطلوب';
        } else if (field.type === FieldType.CHECKBOX && Array.isArray(value) && value.length === 0) {
          errors[field.id] = 'اختر خياراً واحداً على الأقل';
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

  // ============================================
  // Field renderer — same design as /f/[slug]
  // ============================================
  const renderField = (field: FormFieldInput, index: number) => {
    const hasError = !!validationErrors[field.id];
    const value = formValues[field.id];
    const fieldId = `field-${field.id}`;
    const descId = `${fieldId}-desc`;
    const errorId = `${fieldId}-error`;
    const ariaDescribedBy = [field.description ? descId : null, hasError ? errorId : null].filter(Boolean).join(' ') || undefined;

    const fieldStyleClasses = {
      outlined: "border bg-transparent",
      filled: "border-0 bg-muted/50",
      underlined: "border-0 border-b-2 rounded-none bg-transparent",
    };

    const inputClass = cn(
      "w-full min-h-[48px] h-12 px-4 transition-all duration-200 text-sm outline-none",
      "placeholder:text-muted-foreground/60",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:scale-[1.01]",
      fieldStyleClasses[theme.fieldStyle] || fieldStyleClasses.outlined,
      theme.fieldStyle !== 'underlined' && 'rounded-2xl',
      hasError
        ? "border-destructive/50 focus-visible:border-destructive focus-visible:ring-destructive/20"
        : "border-border hover:border-primary/40 focus-visible:ring-primary/20 focus-visible:border-primary/50"
    );

    const inputStyle: React.CSSProperties = {
      borderColor: hasError ? undefined : theme.borderColor,
      borderRadius: theme.fieldStyle !== 'underlined' ? 'var(--form-radius, 16px)' : undefined,
    };

    const fieldLabel = (
      <div className="space-y-1.5 mb-2">
        <Label
          htmlFor={field.type !== FieldType.RADIO && field.type !== FieldType.CHECKBOX && field.type !== FieldType.TOGGLE ? fieldId : undefined}
          className={cn("text-sm font-semibold", hasError ? "text-destructive" : "text-foreground")}
        >
          {showQuestionNumbers && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold mr-1.5 bg-primary/10 text-primary">
              {index + 1}
            </span>
          )}
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
            <input id={fieldId} type="text" value={value || ''} onChange={(e) => handleFieldChange(field.id, e.target.value)} placeholder={field.placeholder || 'أدخل النص...'} className={inputClass} style={inputStyle} aria-invalid={hasError} aria-required={field.required} aria-describedby={ariaDescribedBy} />
            {errorMessage}
          </div>
        );

      case FieldType.TEXTAREA:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <textarea id={fieldId} value={value || ''} onChange={(e) => handleFieldChange(field.id, e.target.value)} placeholder={field.placeholder || 'أدخل النص...'} rows={4} className={cn(inputClass, "h-auto min-h-[120px] max-h-48 py-3.5 resize-y leading-relaxed")} style={inputStyle} aria-invalid={hasError} aria-required={field.required} aria-describedby={ariaDescribedBy} />
            {errorMessage}
          </div>
        );

      case FieldType.EMAIL:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="relative">
              <Mail className={cn("absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 transition-colors", hasError ? "text-destructive/60" : "text-muted-foreground/50")} aria-hidden />
              <input id={fieldId} type="email" value={value || ''} onChange={(e) => handleFieldChange(field.id, e.target.value)} placeholder={field.placeholder || 'example@email.com'} className={cn(inputClass, "pr-12")} style={inputStyle} dir="ltr" aria-invalid={hasError} aria-required={field.required} aria-describedby={ariaDescribedBy} />
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
              <input id={fieldId} type="tel" value={value || ''} onChange={(e) => handleFieldChange(field.id, e.target.value)} placeholder={field.placeholder || '+964 XXX XXX XXXX'} className={cn(inputClass, "pr-12")} style={inputStyle} dir="ltr" aria-invalid={hasError} aria-required={field.required} aria-describedby={ariaDescribedBy} />
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
              <input id={fieldId} type="number" value={value || ''} onChange={(e) => handleFieldChange(field.id, e.target.value)} placeholder={field.placeholder || '0'} min={field.minValue} max={field.maxValue} className={cn(inputClass, "pr-12")} style={inputStyle} dir="ltr" aria-invalid={hasError} aria-required={field.required} aria-describedby={ariaDescribedBy} />
            </div>
            {errorMessage}
          </div>
        );

      case FieldType.DATE:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="relative">
              <Calendar className={cn("absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 transition-colors", hasError ? "text-destructive/60" : "text-muted-foreground/50")} aria-hidden />
              <input id={fieldId} type="date" value={value || ''} onChange={(e) => handleFieldChange(field.id, e.target.value)} className={cn(inputClass, "pr-12")} style={inputStyle} dir="ltr" aria-invalid={hasError} aria-required={field.required} aria-describedby={ariaDescribedBy} />
            </div>
            {errorMessage}
          </div>
        );

      case FieldType.TIME:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="relative">
              <Clock className={cn("absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 transition-colors", hasError ? "text-destructive/60" : "text-muted-foreground/50")} aria-hidden />
              <input id={fieldId} type="time" value={value || ''} onChange={(e) => handleFieldChange(field.id, e.target.value)} className={cn(inputClass, "pr-12")} style={inputStyle} dir="ltr" aria-invalid={hasError} aria-required={field.required} aria-describedby={ariaDescribedBy} />
            </div>
            {errorMessage}
          </div>
        );

      case FieldType.DATETIME:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <input id={fieldId} type="datetime-local" value={value || ''} onChange={(e) => handleFieldChange(field.id, e.target.value)} className={inputClass} style={inputStyle} dir="ltr" aria-invalid={hasError} aria-required={field.required} aria-describedby={ariaDescribedBy} />
            {errorMessage}
          </div>
        );

      case FieldType.SELECT:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <select
              id={fieldId}
              value={value || ''}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className={cn(inputClass, "appearance-none cursor-pointer")}
              style={inputStyle}
              aria-invalid={hasError}
              aria-required={field.required}
              aria-describedby={ariaDescribedBy}
            >
              <option value="">{field.placeholder || 'اختر...'}</option>
              {(field.options || []).map((opt, i) => (
                <option key={i} value={opt}>{opt}</option>
              ))}
            </select>
            {errorMessage}
          </div>
        );

      case FieldType.RADIO:
        return (
          <div className="space-y-1" role="group" aria-labelledby={`${fieldId}-label`} aria-describedby={ariaDescribedBy} aria-invalid={hasError} aria-required={field.required}>
            <div id={`${fieldId}-label`}>{fieldLabel}</div>
            <div className="space-y-2.5 mt-2">
              {(field.options || []).map((opt, i) => {
                const isSelected = value === opt;
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
                    <input id={optId} type="radio" name={fieldId} className="sr-only" checked={isSelected} onChange={() => handleFieldChange(field.id, opt)} />
                    <div className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors", isSelected ? "border-primary bg-primary" : "border-muted-foreground/40")}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm font-medium text-foreground">{opt}</span>
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
                const isSelected = selectedValues.includes(opt);
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
                        if (e.target.checked) handleFieldChange(field.id, [...selectedValues, opt]);
                        else handleFieldChange(field.id, selectedValues.filter((v: string) => v !== opt));
                      }}
                    />
                    <div className={cn("w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors", isSelected ? "border-primary bg-primary" : "border-muted-foreground/40")}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-foreground">{opt}</span>
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
              <button type="button" onClick={() => handleFieldChange(field.id, true)} className={cn("flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all font-medium text-sm", value === true ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/20" : "border-border bg-muted/30 text-muted-foreground hover:border-emerald-300")} role="radio" aria-checked={value === true}>
                <Check className={cn("w-5 h-5", value === true ? "text-emerald-600" : "text-muted-foreground/50")} />
                <span>{field.toggleLabelOn || 'نعم'}</span>
              </button>
              <button type="button" onClick={() => handleFieldChange(field.id, false)} className={cn("flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all font-medium text-sm", value === false ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 ring-2 ring-red-500/20" : "border-border bg-muted/30 text-muted-foreground hover:border-red-300")} role="radio" aria-checked={value === false}>
                <X className={cn("w-5 h-5", value === false ? "text-red-600" : "text-muted-foreground/50")} />
                <span>{field.toggleLabelOff || 'لا'}</span>
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
            <div className="flex items-center gap-1.5 mt-2 p-3 bg-muted/30 rounded-2xl border border-border" role="group" aria-label={field.label}>
              {Array.from({ length: count }).map((_, i) => {
                const starValue = minR + i;
                return (
                  <button key={i} type="button" onClick={() => handleFieldChange(field.id, starValue)} className="p-1.5 rounded-xl hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={`${starValue}`} aria-pressed={currentRating === starValue}>
                    <Star className={cn("w-7 h-7 transition-colors", currentRating >= starValue ? "fill-warning text-warning" : "text-muted-foreground/30")} />
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

      case FieldType.SCALE: {
        const min = field.minValue || 0;
        const max = field.maxValue || 10;
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="space-y-3 mt-2" role="group" aria-label={field.label}>
              <div className="flex justify-between text-xs font-medium text-muted-foreground px-1">
                <span>{min}</span>
                <span>{max}</span>
              </div>
              <div className="flex gap-1.5">
                {Array.from({ length: max - min + 1 }).map((_, i) => {
                  const num = min + i;
                  return (
                    <button key={num} type="button" onClick={() => handleFieldChange(field.id, num)} className={cn("flex-1 py-3 rounded-xl text-sm font-semibold transition-all min-h-[48px]", value === num ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 hover:bg-muted text-foreground border border-border")} aria-pressed={value === num}>
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>
            {errorMessage}
          </div>
        );
      }

      case FieldType.FILE:
      case FieldType.IMAGE:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors min-h-[140px] flex flex-col items-center justify-center cursor-pointer" role="button" tabIndex={0} aria-label="رفع الملفات">
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium text-foreground mb-1">اضغط لرفع الملفات</p>
              <p className="text-xs text-muted-foreground">هذه معاينة فقط</p>
            </div>
            {errorMessage}
          </div>
        );

      case FieldType.SIGNATURE:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-2xl cursor-pointer hover:bg-muted/30 transition-colors" style={{ borderColor: theme.borderColor }}>
              <PenTool className="w-8 h-8 mb-2 text-muted-foreground/50" />
              <span className="text-sm font-medium text-muted-foreground">اضغط للتوقيع (معاينة)</span>
            </div>
            {errorMessage}
          </div>
        );

      case FieldType.URL:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="relative">
              <input
                id={fieldId}
                type="url"
                inputMode="url"
                value={value || ''}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                placeholder={field.placeholder || 'https://example.com'}
                className={cn(inputClass, "pl-10")}
                style={inputStyle}
                dir="ltr"
                aria-invalid={hasError}
                aria-required={field.required}
                aria-describedby={ariaDescribedBy}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                🔗
              </span>
            </div>
            {errorMessage}
          </div>
        );

      case FieldType.MULTISELECT: {
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="space-y-2" role="group" aria-label={field.label} aria-describedby={ariaDescribedBy}>
              {(field.options || []).map((opt, i) => {
                const isChecked = selectedValues.includes(opt);
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
                          ? selectedValues.filter((v: string) => v !== opt)
                          : [...selectedValues, opt];
                        handleFieldChange(field.id, newValue);
                      }}
                      className="w-5 h-5 rounded-md accent-primary"
                    />
                    <span className="text-sm font-medium text-foreground">{opt}</span>
                  </label>
                );
              })}
            </div>
            {errorMessage}
          </div>
        );
      }

      case FieldType.RANKING: {
        const rankingOptions = field.options || [];
        const rankedItems = Array.isArray(value) ? value : rankingOptions;
        return (
          <div className="space-y-1">
            {fieldLabel}
            <div className="space-y-2" role="list" aria-label={field.label} aria-describedby={ariaDescribedBy}>
              {rankedItems.map((item: string, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-4 bg-muted/30 border border-border rounded-2xl min-h-[52px] cursor-move"
                  role="listitem"
                >
                  <span className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-sm font-bold">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-foreground flex-1">{item}</span>
                  <span className="text-muted-foreground/50">⋮⋮</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">اسحب العناصر لترتيبها حسب الأفضلية</p>
            {errorMessage}
          </div>
        );
      }

      case FieldType.MATRIX: {
        const matrixRows = field.matrixRows || [];
        const matrixColumns = field.matrixColumns || [];
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
                    {matrixColumns.map((col, i) => (
                      <th key={i} className="p-2 text-center text-xs font-medium text-muted-foreground bg-muted/30 last:rounded-tl-lg">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-border/50 last:border-0">
                      <td className="p-3 text-sm font-medium text-foreground bg-muted/10">{row}</td>
                      {matrixColumns.map((col, colIndex) => (
                        <td key={colIndex} className="p-2 text-center">
                          <label className="cursor-pointer flex items-center justify-center">
                            <input
                              type="radio"
                              name={`matrix-${field.id}-${rowIndex}`}
                              checked={matrixValue[row] === col}
                              onChange={() => handleFieldChange(field.id, { ...matrixValue, [row]: col })}
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

      // Layout blocks
      case FieldType.HEADING:
        return (
          <div className="py-2">
            <h2 className="text-xl font-bold text-foreground">{field.label}</h2>
            {field.description && <p className="text-sm text-muted-foreground mt-1">{field.description}</p>}
          </div>
        );

      case FieldType.TITLE:
        return (
          <div className="py-3">
            <h3 className="text-lg font-semibold text-foreground">{field.label}</h3>
            {field.description && <p className="text-sm text-muted-foreground mt-1">{field.description}</p>}
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

      case FieldType.HIDDEN:
        return null;

      default:
        return (
          <div className="space-y-1">
            {fieldLabel}
            <input id={fieldId} type="text" value={value || ''} onChange={(e) => handleFieldChange(field.id, e.target.value)} placeholder={field.placeholder || 'أدخل البيانات...'} className={inputClass} style={inputStyle} aria-invalid={hasError} aria-required={field.required} aria-describedby={ariaDescribedBy} />
            {errorMessage}
          </div>
        );
    }
  };

  // ============================================
  // Render — same layout as /f/[slug]
  // ============================================

  return (
    <div
      className={cn("h-full overflow-y-auto transition-colors relative bg-background")}
      dir="rtl"
      style={themeStyles}
    >
      {/* Preview Banner - subtle fixed indicator at bottom */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
        {/* Preview indicator pill */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-3 px-5 py-2.5 bg-card/95 backdrop-blur-xl rounded-full border border-border/60 shadow-lg"
        >
          <span className="text-xs text-muted-foreground">هذه معاينة فقط</span>
          <div className="w-px h-4 bg-border" />
          <button
            type="button"
            onClick={onClose || (() => window.close())}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            إغلاق
          </button>
        </motion.div>
      </div>

      {/* Sticky Header — same as /f/[slug] */}
      <header className="sticky top-2 z-40 mx-4 sm:mx-auto max-w-2xl relative">
        <div className="bg-card/95 backdrop-blur-xl rounded-4xl border border-border/60 px-4 py-3 flex items-center justify-between gap-3 transition-all duration-300">
          {/* Form Title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-foreground truncate">ركني</h1>
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
            {formUrl && (
              <button
                onClick={() => setShowModal('share')}
                className="w-9 h-9 flex items-center justify-center hover:bg-muted rounded-xl transition-all duration-200 text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95"
                aria-label="مشاركة"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Info Sheet — same as /f/[slug] */}
        <AnimatePresence>
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
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                className="absolute top-full left-0 right-0 sm:left-auto sm:right-0 sm:w-[340px] mt-2 z-50 rounded-4xl overflow-hidden bg-card border border-border/60 backdrop-blur-xl"
              >
                {/* Top bar */}
                <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                  <button
                    onClick={() => setShowInfoSheet(false)}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-card border border-border text-muted-foreground hover:bg-muted transition-all duration-200 flex-shrink-0"
                    aria-label="إغلاق"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <span className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    معاينة النموذج
                  </span>
                </div>

                {/* Banner in info sheet */}
                {bannerUrl && (
                  <div className="mx-4 mb-3 relative">
                    <div className="rounded-4xl overflow-hidden aspect-video bg-muted relative">
                      <img src={bannerUrl} alt={title} className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}

                {/* Content — bg-primary like /f/[slug] */}
                <div className="mx-4 mb-4 rounded-4xl overflow-hidden bg-primary">
                  <div className="p-4 space-y-4">
                    {description && (
                      <p className="text-primary-foreground text-base leading-relaxed line-clamp-3">
                        {description}
                      </p>
                    )}
                    <p className="text-primary-foreground/70 text-sm">
                      {title || 'نموذج بدون عنوان'} — ركني
                    </p>

                    {/* Owner */}
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center text-primary-foreground text-sm font-medium">
                          {ownerName.charAt(0)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-primary-foreground font-medium truncate">{ownerName}</p>
                        <span className="text-primary-foreground/70 text-xs">المنشئ</span>
                      </div>
                    </div>

                    {/* URL */}
                    {formUrl && (
                      <p className="text-primary-foreground/70 text-sm truncate">{formUrl}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-6 pb-20 relative z-10">
        {/* Cover Image */}
        {bannerUrl && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6 relative"
          >
            <div className="rounded-4xl border border-border/60 overflow-hidden relative">
              <img src={bannerUrl} alt={title} className="w-full h-48 sm:h-56 object-cover" />
            </div>
          </motion.div>
        )}

        {/* Form Info Card — same as /f/[slug] */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-4xl border border-border p-5 mb-6"
        >
          {/* Owner */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
            <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium flex-shrink-0">
              {ownerName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{ownerName}</p>
              <p className="text-xs text-muted-foreground">منشئ النموذج</p>
            </div>
          </div>

          {/* Title & Description */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">{title || 'نموذج بدون عنوان'}</h1>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* Multi-step indicator — same as /f/[slug] */}
        {isMultiStep && steps.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="mb-6"
          >
            {showProgressBar && (
              <div className="flex gap-1.5 mb-3">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex-1 h-1.5 rounded-full transition-all duration-300",
                      index <= currentStep ? "bg-primary" : "bg-muted"
                    )}
                  />
                ))}
              </div>
            )}
            <div className="bg-card rounded-2xl border border-border/60 p-4 transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-sm font-semibold">
                  {currentStep + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{steps[currentStep]?.title || `الخطوة ${currentStep + 1}`}</p>
                  {steps[currentStep]?.description && (
                    <p className="text-xs text-muted-foreground">{steps[currentStep].description}</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Form Fields — same container as /f/[slug] */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="rounded-4xl border transition-all duration-300"
          style={{
            backgroundColor: theme.backgroundColor,
            borderColor: theme.borderColor,
            borderRadius: 'var(--form-radius, 24px)',
          }}
        >
          <div className="p-5" style={{ gap: 'var(--form-spacing, 20px)', display: 'flex', flexDirection: 'column' }}>
            {currentFields.length > 0 ? (
              currentFields.map((field, index) => (
                <Fragment key={field.id}>{renderField(field, index)}</Fragment>
              ))
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-primary/10">
                  <FileText className="w-10 h-10 text-primary" />
                </div>
                <p className="text-lg font-medium text-foreground">لا توجد حقول</p>
                <p className="text-sm mt-1 text-muted-foreground">أضف حقولاً للنموذج</p>
              </div>
            )}
          </div>

          {/* Actions — same as /f/[slug] */}
          {currentFields.length > 0 && (
            <div className="p-5 border-t border-border flex items-center justify-between gap-3">
              {isMultiStep && currentStep > 0 ? (
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

              {isMultiStep && currentStep < totalSteps - 1 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: theme.primaryColor,
                    borderRadius: 'var(--form-radius, 12px)',
                  }}
                >
                  التالي
                  <ChevronLeft className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    toast.warning('هذه معاينة فقط — لا يمكن إرسال البيانات');
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 text-white rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 min-h-[44px]"
                  style={{
                    backgroundColor: theme.primaryColor,
                    borderRadius: 'var(--form-radius, 12px)',
                  }}
                >
                  <Send className="w-4 h-4" />
                  إرسال
                </button>
              )}
            </div>
          )}
        </motion.div>

        {/* Footer — same as /f/[slug] */}
        <footer className="mt-8 pt-6 border-t border-border">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center">
            <span className="text-xs text-muted-foreground">مدعوم من</span>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors hover:underline underline-offset-2"
            >
              ركني
            </a>
          </div>
          <p className="text-center text-xs text-muted-foreground/70 mt-2">
            © {new Date().getFullYear()} Rukny
          </p>
        </footer>
      </main>

      {/* Share Modal — same as /f/[slug] */}
      <AnimatePresence>
        {showModal === 'share' && formUrl && (
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
                <button onClick={() => setShowModal(null)} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl mb-4">
                <input type="text" value={formUrl} readOnly className="flex-1 bg-transparent text-sm text-foreground outline-none truncate" dir="ltr" />
                <button
                  onClick={handleCopyLink}
                  className={cn("p-2 rounded-lg transition-all duration-200", copied ? "bg-green-100 text-green-600" : "bg-background hover:bg-muted/80 text-muted-foreground")}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Share Buttons — same as /f/[slug] */}
              <div className="grid grid-cols-4 gap-3 mt-6">
                {/* WhatsApp */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(title + ' ' + formUrl)}`}
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
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(formUrl)}&text=${encodeURIComponent(title)}`}
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
                  href={`https://t.me/share/url?url=${encodeURIComponent(formUrl)}&text=${encodeURIComponent(title)}`}
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
                  href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(formUrl)}`}
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

export default FormFullPreview;
