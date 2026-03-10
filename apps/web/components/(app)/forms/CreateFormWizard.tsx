'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import {
  FileText,
  Mail,
  Plus,
  Trash2,
  Edit2,
  ArrowRight,
  Loader2,
  Layers,
  Image as ImageLucide,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Search,
  CheckCircle2,
  Cloud,
  FolderOpen,
  Sheet,
  Zap,
  Shield,
  Share2,
  HardDrive,
  Sparkles,
  Link as LinkIcon,
  Clock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ProgressIndicator from '@/components/ui/progress-indicator';
import { 
  useForms, 
  FormType, 
  FormStatus,
  FieldType,
  FORM_TYPE_LABELS,
  FORM_STATUS_LABELS,
  FIELD_TYPE_LABELS,
} from '@/lib/hooks/useForms';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/toast-provider';
import { cn } from '@/lib/utils';
import { type FormFieldInput } from './FieldEditor';
import { StepEditor, type FormStepInput } from './StepEditor';
import FormBannersUpload, { type BannerDisplayMode } from './FormBannersUpload';
import { FormTemplateSelector, type TemplateLanguage, getTemplateById } from './templates';
import { type FormTheme, DEFAULT_THEME } from './FormThemeCustomizer';
import { useGoogleSheets } from '@/lib/hooks/useGoogleSheets';
import { useAuth } from '@/providers/auth-provider';
import { isValidFormSlug } from '@/lib/utils/generateFormSlug';
import {
  TOTAL_STEPS,
  SUGGESTED_FIELDS,
  ALL_FIELD_TYPES,
  getFieldTypeIcon,
  FORM_PREVIEW_KEY,
  type StorageOption,
} from './wizard-constants';
import { WizardStepHeader } from './WizardStepHeader';
import { SettingToggle } from './SettingToggle';
import { FieldTypeButton } from './FieldTypeButton';
import { FieldEditDialog } from './FieldEditDialog';

// صف حقل قابل للسحب — كل صف له useDragControls خاص لتفادي سحب العنصر الخاطئ
function DraggableFieldRow({
  field,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: {
  field: FormFieldInput;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dragControls = useDragControls();
  const FieldIcon = getFieldTypeIcon(field.type);
  return (
    <Reorder.Item
      value={field}
      dragListener={false}
      dragControls={dragControls}
      transition={{ type: 'spring', stiffness: 300, damping: 35 }}
      className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/50 rounded-2xl border border-transparent hover:border-border transition-colors duration-200 group cursor-default outline-none select-none data-[dragging=true]:z-10 data-[dragging=true]:shadow-lg data-[dragging=true]:scale-[1.02] data-[dragging=true]:border-primary/30"
    >
      <div
        onPointerDown={(e) => {
          e.preventDefault();
          dragControls.start(e);
        }}
        className="flex flex-shrink-0 cursor-grab active:cursor-grabbing touch-none p-1 -m-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="سحب لإعادة الترتيب"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <div className="flex flex-col -space-y-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-1 rounded-md hover:bg-background disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
          aria-label="تحريك لأعلى"
        >
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="p-1 rounded-md hover:bg-background disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
          aria-label="تحريك لأسفل"
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <FieldIcon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground truncate">
            {field.label || FIELD_TYPE_LABELS[field.type as FieldType]}
          </span>
          {field.required && <span className="text-destructive text-xs font-bold">*</span>}
        </div>
        <span className="text-xs text-muted-foreground">
          {FIELD_TYPE_LABELS[field.type as FieldType]}
        </span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
        <button type="button" onClick={onEdit} className="p-2 rounded-xl hover:bg-background transition-colors" aria-label="تعديل">
          <Edit2 className="w-4 h-4 text-muted-foreground" />
        </button>
        <button type="button" onClick={onDelete} className="p-2 rounded-xl hover:bg-destructive/10 transition-colors" aria-label="حذف">
          <Trash2 className="w-4 h-4 text-destructive/70" />
        </button>
      </div>
    </Reorder.Item>
  );
}

// ============================================
// Types
// ============================================

// Draft shape for optional restore (only when user explicitly chooses "متابعة المسودة")
export type FormDraftRestore = {
  currentStep?: number;
  selectedTemplateId?: string | null;
  templateLanguage?: TemplateLanguage;
  title?: string;
  slug?: string;
  description?: string;
  formType?: FormType;
  status?: FormStatus;
  isMultiStep?: boolean;
  fields?: FormFieldInput[];
  formSteps?: FormStepInput[];
  allowMultipleSubmissions?: boolean;
  requiresAuthentication?: boolean;
  showProgressBar?: boolean;
  showQuestionNumbers?: boolean;
  notifyOnSubmission?: boolean;
  notificationEmail?: string;
  formTheme?: FormTheme;
  enableGoogleSheets?: boolean;
  storageOption?: StorageOption;
};

// ============================================
// Component
// ============================================

interface CreateFormWizardProps {
  initialDraft?: FormDraftRestore | null;
  initialSlug?: string;
}

export function CreateFormWizard({ initialDraft, initialSlug }: CreateFormWizardProps = {}) {
  const router = useRouter();
  const { createForm, isLoading } = useForms();
  const { connect: connectGoogleSheets } = useGoogleSheets();
  const { user, isAuthenticated } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 1: Template Selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateLanguage, setTemplateLanguage] = useState<TemplateLanguage>('ar');
  
  // Theme (for phone preview)
  const [formTheme, setFormTheme] = useState<FormTheme>(DEFAULT_THEME);
  
  // Step 2: Basic Info
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState(initialSlug || '');
  const [description, setDescription] = useState('');
  const [formType, setFormType] = useState<FormType>(FormType.SURVEY);
  const [status, setStatus] = useState<FormStatus>(FormStatus.DRAFT);
  // Banners state (cover images)
  const [banners, setBanners] = useState<(File | string)[]>([]);
  const [bannerDisplayMode, setBannerDisplayMode] = useState<BannerDisplayMode>('single');
  const [isMultiStep, setIsMultiStep] = useState(false);
  const [showBannerDialog, setShowBannerDialog] = useState(false);
  
  // Step 3: Fields (single-step form)
  const [fields, setFields] = useState<FormFieldInput[]>([]);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');
  
  // Step 3: Steps (multi-step form)
  const [formSteps, setFormSteps] = useState<FormStepInput[]>([]);
  
  // Step 4: Settings
  const [allowMultipleSubmissions, setAllowMultipleSubmissions] = useState(false);

  // Step 5: Integrations
  const [enableGoogleSheets, setEnableGoogleSheets] = useState(false);
  const [storageOption, setStorageOption] = useState<StorageOption>(null);
  const [requiresAuthentication, setRequiresAuthentication] = useState(false);
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [showQuestionNumbers, setShowQuestionNumbers] = useState(true);
  const [notifyOnSubmission, setNotifyOnSubmission] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState('');

  // Generate unique slug
  const generateSlug = useCallback(() => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }, []);

  // Restore state from initialDraft if provided
  useEffect(() => {
    if (initialDraft) {
      if (initialDraft.currentStep) setCurrentStep(initialDraft.currentStep);
      if (initialDraft.selectedTemplateId !== undefined) setSelectedTemplateId(initialDraft.selectedTemplateId);
      if (initialDraft.templateLanguage) setTemplateLanguage(initialDraft.templateLanguage);
      if (initialDraft.title) setTitle(initialDraft.title);
      if (initialDraft.slug) setSlug(initialDraft.slug);
      if (initialDraft.description) setDescription(initialDraft.description);
      if (initialDraft.formType) setFormType(initialDraft.formType);
      if (initialDraft.status) setStatus(initialDraft.status);
      if (initialDraft.isMultiStep !== undefined) setIsMultiStep(initialDraft.isMultiStep);
      if (initialDraft.fields) setFields(initialDraft.fields);
      if (initialDraft.formSteps) setFormSteps(initialDraft.formSteps);
      if (initialDraft.allowMultipleSubmissions !== undefined) setAllowMultipleSubmissions(initialDraft.allowMultipleSubmissions);
      if (initialDraft.requiresAuthentication !== undefined) setRequiresAuthentication(initialDraft.requiresAuthentication);
      if (initialDraft.showProgressBar !== undefined) setShowProgressBar(initialDraft.showProgressBar);
      if (initialDraft.showQuestionNumbers !== undefined) setShowQuestionNumbers(initialDraft.showQuestionNumbers);
      if (initialDraft.notifyOnSubmission !== undefined) setNotifyOnSubmission(initialDraft.notifyOnSubmission);
      if (initialDraft.notificationEmail) setNotificationEmail(initialDraft.notificationEmail);
      if (initialDraft.formTheme) setFormTheme(initialDraft.formTheme);
      if (initialDraft.enableGoogleSheets !== undefined) setEnableGoogleSheets(initialDraft.enableGoogleSheets);
      if (initialDraft.storageOption !== undefined) setStorageOption(initialDraft.storageOption);
    } else if (!slug) {
      setSlug(generateSlug());
    }
  }, [initialDraft]);

  // Handle template selection
  const handleSelectTemplate = useCallback((templateId: string | null, templateFields: FormFieldInput[]) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      const template = getTemplateById(templateId);
      if (template) {
        setTitle(template.name[templateLanguage]);
        setDescription(template.description[templateLanguage]);
        setFields(templateFields);
      }
    }
  }, [templateLanguage]);

  // Handle start from scratch
  const handleStartFromScratch = useCallback(() => {
    setSelectedTemplateId(null);
    setTitle('');
    setDescription('');
    setFields([]);
  }, []);

  // Handle language change
  const handleTemplateLanguageChange = useCallback((language: TemplateLanguage) => {
    setTemplateLanguage(language);
  }, []);

  // Helper to convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleGoToPreview = useCallback(() => {
    if (!slug || !isValidFormSlug(slug)) {
      toast.error('الرجاء إدخال رابط صالح للمعاينة');
      return;
    }

    // Prefer a stable banner URL. For File objects, use an object URL (works best with same-tab navigation).
    let bannerUrl: string | undefined;
    const firstBanner = banners[0];
    if (typeof firstBanner === 'string') {
      bannerUrl = firstBanner;
    } else if (firstBanner instanceof File) {
      try {
        bannerUrl = URL.createObjectURL(firstBanner);
      } catch {
        bannerUrl = undefined;
      }
    }

    const previewData = {
      title: title || 'نموذج بدون عنوان',
      description,
      slug,
      userId: user?.id,
      fields: isMultiStep ? [] : fields,
      isMultiStep,
      steps: formSteps,
      theme: formTheme,
      bannerUrl,
      allowMultipleSubmissions,
      requiresAuthentication,
      showProgressBar,
      showQuestionNumbers,
    };

    // Light security: don't allow preview without auth for user-scoped pages.
    if (!isAuthenticated || !user) {
      toast.error('يجب تسجيل الدخول للمعاينة');
      router.push('/login');
      return;
    }

    localStorage.setItem(FORM_PREVIEW_KEY, JSON.stringify(previewData));
    window.open(`/app/forms/preview/${slug}`, '_blank');
  }, [
    slug,
    title,
    description,
    user,
    isAuthenticated,
    fields,
    isMultiStep,
    formSteps,
    formTheme,
    banners,
    allowMultipleSubmissions,
    requiresAuthentication,
    showProgressBar,
    showQuestionNumbers,
    router,
  ]);

  // Add new field (مع قيم افتراضية لكل نوع)
  const handleAddField = useCallback((type: FieldType) => {
    const newField: FormFieldInput = {
      id: `field-${Date.now()}`,
      label: FIELD_TYPE_LABELS[type],
      type,
      order: fields.length,
      required: false,
      placeholder: '',
      options: type === FieldType.SELECT || type === FieldType.RADIO || type === FieldType.CHECKBOX
        ? ['خيار 1', 'خيار 2', 'خيار 3']
        : type === FieldType.RANKING
          ? ['العنصر 1', 'العنصر 2', 'العنصر 3']
          : undefined,
      minValue: type === FieldType.RATING ? 1 : type === FieldType.SCALE ? 0 : undefined,
      maxValue: type === FieldType.RATING ? 5 : type === FieldType.SCALE ? 10 : undefined,
      matrixRows: type === FieldType.MATRIX ? ['صف 1', 'صف 2'] : undefined,
      matrixColumns: type === FieldType.MATRIX ? ['ضعيف', 'مقبول', 'جيد', 'ممتاز'] : undefined,
      signaturePenColor: type === FieldType.SIGNATURE ? '#0f172a' : undefined,
      signaturePenWidth: type === FieldType.SIGNATURE ? 2 : undefined,
      toggleLabelOn: type === FieldType.TOGGLE ? 'نعم' : undefined,
      toggleLabelOff: type === FieldType.TOGGLE ? 'لا' : undefined,
      maxFileSize: type === FieldType.FILE ? 10 * 1024 * 1024 : undefined,
      maxFiles: type === FieldType.FILE ? 1 : undefined,
      allowedFileTypes: type === FieldType.FILE ? ['*/*'] : undefined,
    };
    setFields(prev => [...prev, newField]);
    setShowFieldSelector(false);
    setEditingFieldId(newField.id);
  }, [fields.length]);

  // Update field
  const handleUpdateField = useCallback((id: string, updates: Partial<FormFieldInput>) => {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  // Delete field
  const handleDeleteField = useCallback((id: string) => {
    setFields(prev => prev.filter(f => f.id !== id));
    if (editingFieldId === id) setEditingFieldId(null);
  }, [editingFieldId]);

  // Duplicate field
  const handleDuplicateField = useCallback((id: string) => {
    const field = fields.find(f => f.id === id);
    if (field) {
      const newField: FormFieldInput = {
        ...field,
        id: `field-${Date.now()}`,
        label: `${field.label} (نسخة)`,
        order: fields.length,
      };
      setFields(prev => [...prev, newField]);
    }
  }, [fields]);

  // Reorder fields
  const handleReorderFields = useCallback((newOrder: FormFieldInput[]) => {
    setFields(newOrder.map((f, index) => ({ ...f, order: index })));
  }, []);

  // Move field up/down
  const handleMoveField = useCallback((id: string, direction: 'up' | 'down') => {
    setFields(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (idx < 0) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy.map((f, i) => ({ ...f, order: i }));
    });
  }, []);

  // Handle add option to field
  const handleAddOption = useCallback((fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      const currentOptions = field.options || [];
      handleUpdateField(fieldId, { options: [...currentOptions, `خيار ${currentOptions.length + 1}`] });
    }
  }, [fields, handleUpdateField]);

  // Handle update option
  const handleUpdateOption = useCallback((fieldId: string, index: number, value: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      const newOptions = [...(field.options || [])];
      newOptions[index] = value;
      handleUpdateField(fieldId, { options: newOptions });
    }
  }, [fields, handleUpdateField]);

  // Handle remove option
  const handleRemoveOption = useCallback((fieldId: string, index: number) => {
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      const newOptions = (field.options || []).filter((_, i) => i !== index);
      handleUpdateField(fieldId, { options: newOptions });
    }
  }, [fields, handleUpdateField]);

  // Filtered field types for search
  const filteredFieldTypes = useMemo(() => {
    if (!fieldSearchQuery.trim()) return ALL_FIELD_TYPES;
    const q = fieldSearchQuery.toLowerCase();
    return ALL_FIELD_TYPES.filter(f => 
      f.label.includes(q) || f.description.includes(q) || FIELD_TYPE_LABELS[f.type]?.toLowerCase().includes(q)
    );
  }, [fieldSearchQuery]);

  // Get total fields count
  const getTotalFieldsCount = useCallback(() => {
    if (isMultiStep) {
      return formSteps.reduce((acc, step) => acc + step.fields.length, 0);
    }
    return fields.length;
  }, [isMultiStep, formSteps, fields.length]);

  // Validate step
  const validateStep = useCallback(() => {
    if (currentStep === 1) {
      return true;
    }
    if (currentStep === 2) {
      if (!title.trim()) {
        toast.error('الرجاء إدخال عنوان النموذج');
        return false;
      }
      if (!slug || !isValidFormSlug(slug)) {
        toast.error('الرجاء إدخال رابط صالح');
        return false;
      }
    }
    if (currentStep === 3) {
      if (isMultiStep) {
        if (formSteps.length === 0) {
          toast.error('الرجاء إضافة خطوة واحدة على الأقل');
          return false;
        }
        const totalFields = getTotalFieldsCount();
        if (totalFields === 0) {
          toast.error('الرجاء إضافة حقل واحد على الأقل');
          return false;
        }
      } else {
        if (fields.length === 0) {
          toast.error('الرجاء إضافة حقل واحد على الأقل');
          return false;
        }
      }
    }
    return true;
  }, [currentStep, title, slug, isMultiStep, formSteps, fields, getTotalFieldsCount]);

  // Navigation
  const handleContinue = useCallback(() => {
    if (validateStep()) {
      setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS));
    }
  }, [validateStep]);

  const handleBack = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  }, []);

  // Submit form
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (currentStep !== TOTAL_STEPS) return;
    
    setIsSubmitting(true);
    
    try {
      // Convert banner files to base64
      let coverImageData: string | undefined;
      let bannerImagesData: string[] = [];
      
      for (const banner of banners) {
        if (typeof banner === 'string') {
          bannerImagesData.push(banner);
        } else {
          const base64 = await fileToBase64(banner);
          bannerImagesData.push(base64);
        }
      }
      
      // Use first banner as cover image for backwards compatibility
      if (bannerImagesData.length > 0) {
        coverImageData = bannerImagesData[0];
      }

      const formData: any = {
        title,
        slug,
        description: description || undefined,
        type: formType,
        status,
        isMultiStep,
        allowMultipleSubmissions,
        requiresAuthentication,
        showProgressBar,
        showQuestionNumbers,
        notifyOnSubmission,
        notificationEmail: notifyOnSubmission ? notificationEmail : undefined,
        theme: formTheme,
        coverImage: coverImageData,
        bannerImages: bannerImagesData.length > 0 ? bannerImagesData : undefined,
        bannerDisplayMode: bannerImagesData.length > 0 ? bannerDisplayMode : undefined,
      };

      // Add fields or steps based on form type
      if (isMultiStep) {
        formData.steps = formSteps.map(step => ({
          title: step.title,
          description: step.description,
          order: step.order,
          fields: step.fields.map(f => ({
            label: f.label,
            description: f.description,
            type: f.type,
            order: f.order,
            required: f.required,
            placeholder: f.placeholder,
            options: f.options,
            minValue: f.minValue,
            maxValue: f.maxValue,
            matrixRows: f.matrixRows,
            matrixColumns: f.matrixColumns,
            signaturePenColor: f.signaturePenColor,
            signaturePenWidth: f.signaturePenWidth,
            toggleLabelOn: f.toggleLabelOn,
            toggleLabelOff: f.toggleLabelOff,
            allowedFileTypes: f.allowedFileTypes,
            maxFileSize: f.maxFileSize,
            maxFiles: f.maxFiles,
          })),
        }));
      } else {
        formData.fields = fields.map(f => ({
          label: f.label,
          description: f.description,
          type: f.type,
          order: f.order,
          required: f.required,
          placeholder: f.placeholder,
          options: f.options,
          minValue: f.minValue,
          maxValue: f.maxValue,
          matrixRows: f.matrixRows,
          matrixColumns: f.matrixColumns,
          signaturePenColor: f.signaturePenColor,
          signaturePenWidth: f.signaturePenWidth,
          toggleLabelOn: f.toggleLabelOn,
          toggleLabelOff: f.toggleLabelOff,
          allowedFileTypes: f.allowedFileTypes,
          maxFileSize: f.maxFileSize,
          maxFiles: f.maxFiles,
        }));
      }
      
      // Add integration preferences
      formData.enableGoogleSheets = enableGoogleSheets;
      formData.storageProvider = storageOption || 's3';

      const result = await createForm(formData);
      
      if (result) {
        toast.success('تم إنشاء النموذج بنجاح! 🎉');
        
        // Handle Google Sheets OAuth if enabled
        if (enableGoogleSheets && result.id) {
          toast.info('جاري ربط Google Sheets...', { duration: 3000 });
          try {
            const gsResult = await connectGoogleSheets(result.id);
            if (gsResult?.authUrl) {
              window.location.href = gsResult.authUrl;
              return;
            }
          } catch {
            toast.error('فشل في ربط Google Sheets. يمكنك ربطه لاحقاً من صفحة الردود.');
          }
        }
        
        router.push('/app/forms');
      }
    } catch (error: any) {
      toast.error(error.message || 'فشل في إنشاء النموذج');
    } finally {
      setIsSubmitting(false);
    }
  }, [currentStep, banners, title, slug, description, formType, status, isMultiStep, allowMultipleSubmissions, requiresAuthentication, showProgressBar, showQuestionNumbers, notifyOnSubmission, notificationEmail, formTheme, bannerDisplayMode, formSteps, fields, enableGoogleSheets, storageOption, createForm, connectGoogleSheets, router]);

  const editingField = editingFieldId ? fields.find(f => f.id === editingFieldId) : null;

  // ============================================
  // Render Steps
  // ============================================

  // Step 1: Template Selection
  const renderStep1 = () => (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 15, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -15, scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      style={{ willChange: 'transform, opacity' }}
      className="flex flex-col items-center text-sm text-foreground"
    >
      <div className="w-full max-w-md sm:max-w-xl px-1">
        <FormTemplateSelector
          selectedTemplateId={selectedTemplateId}
          selectedLanguage={templateLanguage}
          onSelectTemplate={handleSelectTemplate}
          onLanguageChange={handleTemplateLanguageChange}
          onStartFromScratch={handleStartFromScratch}
        />
      </div>
    </motion.div>
  );

  // Step 2: Basic Info
  const renderStep2 = () => (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 15, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -15, scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      style={{ willChange: 'transform, opacity' }}
      className="flex flex-col items-center w-full"
    >
      {/* Clean Header */}
      <WizardStepHeader step={2} totalSteps={TOTAL_STEPS} title="معلومات النموذج" description="أدخل المعلومات الأساسية" />

      {/* Form Fields */}
      <div className="w-full max-w-md space-y-4 px-1">
        {/* Title Input */}
        <div>
          <label htmlFor="title" className="text-sm font-medium text-foreground mb-2 block">
            العنوان <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="اسم النموذج"
            className="w-full h-11 px-4 bg-muted/50 border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-foreground placeholder:text-muted-foreground text-sm"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="text-sm font-medium text-foreground mb-2 block">
            الوصف <span className="text-muted-foreground text-xs">(اختياري)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="وصف مختصر..."
            rows={2}
            className="w-full p-3 bg-muted/50 border border-border rounded-2xl resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 text-foreground placeholder:text-muted-foreground text-sm"
          />
        </div>

        {/* Type & Status */}
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
          {/* Form Type */}
          <div className="flex-1 min-w-[140px]">
            <label className="text-sm font-medium text-foreground mb-2 block">النوع</label>
            <DropdownMenu>
              <DropdownMenuTrigger className="h-11 w-full flex items-center justify-between px-4 border border-border bg-muted/50 rounded-2xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-colors">
                <span>{FORM_TYPE_LABELS[formType]}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup value={formType} onValueChange={(v) => setFormType(v as FormType)}>
                  {Object.entries(FORM_TYPE_LABELS).map(([key, label]) => (
                    <DropdownMenuRadioItem key={key} value={key}>{label}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Form Status */}
          <div className="flex-1 min-w-[140px]">
            <label className="text-sm font-medium text-foreground mb-2 block">الحالة</label>
            <DropdownMenu>
              <DropdownMenuTrigger className="h-11 w-full flex items-center justify-between px-4 border border-border bg-muted/50 rounded-2xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-colors">
                <span>{FORM_STATUS_LABELS[status]}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup value={status} onValueChange={(v) => setStatus(v as FormStatus)}>
                  {Object.entries(FORM_STATUS_LABELS).map(([key, label]) => (
                    <DropdownMenuRadioItem key={key} value={key}>{label}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Multi-step Toggle - Compact */}
        <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-2xl transition-all duration-200 hover:bg-muted/40">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">متعدد الخطوات</span>
          </div>
          <Switch checked={isMultiStep} onCheckedChange={setIsMultiStep} />
        </div>

        {/* Cover Images - Button to open Dialog */}
        <button
          type="button"
          onClick={() => setShowBannerDialog(true)}
          className="w-full flex items-center justify-between py-3 px-4 bg-muted/30 hover:bg-muted/40 rounded-2xl transition-all duration-200 group"
          aria-label="إضافة صور الغلاف"
        >
          <div className="flex items-center gap-2">
            <ImageLucide className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">صور الغلاف</span>
            {banners.length > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {banners.length} {banners.length === 1 ? 'صورة' : 'صور'}
              </span>
            )}
          </div>
          <Plus className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>

        {/* Banner Thumbnails Preview */}
        {banners.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {banners.map((banner, idx) => {
              const url = typeof banner === 'string' ? banner : URL.createObjectURL(banner);
              return (
                <div
                  key={idx}
                  className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-border/50 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setShowBannerDialog(true)}
                >
                  <img src={url} alt={`غلاف ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
              );
            })}
          </div>
        )}

        {/* Banner Upload Dialog */}
        <Dialog open={showBannerDialog} onOpenChange={setShowBannerDialog}>
          <DialogContent className="sm:max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-center">صور الغلاف</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <FormBannersUpload
                banners={banners}
                onChange={setBanners}
                displayMode={bannerDisplayMode}
                onDisplayModeChange={setBannerDisplayMode}
                maxFiles={5}
                maxSizeMB={5}
              />
            </div>
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={() => setShowBannerDialog(false)}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                تم
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </motion.div>
  );

  // Step 3: Fields
  const renderStep3 = () => (
    <motion.div
      key="step3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col items-center w-full"
    >
      {/* Header */}
      <WizardStepHeader step={3} totalSteps={TOTAL_STEPS} title="حقول النموذج" description="أضف الحقول التي تريد جمع بياناتها" />

      <div className="w-full max-w-md space-y-4">
        {!isMultiStep && fields.length > 0 && (
          <p className="text-[11px] text-muted-foreground text-center">اسحب من أيقونة ⋮⋮ أو استخدم الأسهم لإعادة الترتيب</p>
        )}
        {/* Multi-step Editor */}
        {isMultiStep ? (
          <StepEditor
            steps={formSteps}
            onStepsChange={setFormSteps}
          />
        ) : (
          <>
            {/* Fields List */}
            {fields.length > 0 ? (
              <Reorder.Group
                axis="y"
                values={fields}
                onReorder={handleReorderFields}
                className="space-y-2.5"
                style={{ listStyle: 'none' }}
              >
                {fields.map((field, index) => (
                  <DraggableFieldRow
                    key={field.id}
                    field={field}
                    index={index}
                    total={fields.length}
                    onMoveUp={() => handleMoveField(field.id, 'up')}
                    onMoveDown={() => handleMoveField(field.id, 'down')}
                    onEdit={() => setEditingFieldId(field.id)}
                    onDelete={() => handleDeleteField(field.id)}
                  />
                ))}
              </Reorder.Group>
            ) : (
              <motion.div
                className="text-center py-12 border-2 border-dashed border-border rounded-2xl bg-muted/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-7 h-7 text-primary/30" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">ابدأ بإضافة الحقول</p>
                <p className="text-xs text-muted-foreground">اضغط الزر أدناه لإضافة حقل جديد</p>
              </motion.div>
            )}

            {/* Add Field Button */}
            <button
              type="button"
              onClick={() => { setShowFieldSelector(true); setFieldSearchQuery(''); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-foreground hover:bg-foreground/90 text-background rounded-2xl transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة حقل</span>
            </button>

            {/* Add Field Dialog */}
            <Dialog open={showFieldSelector} onOpenChange={setShowFieldSelector}>
              <DialogContent
                showCloseButton={false}
                className="w-[95vw] sm:w-[520px] sm:max-w-[90vw] rounded-[2rem] p-0 gap-0 max-h-[85vh] flex flex-col overflow-hidden border border-border/80 shadow-xl"
              >
                {/* Header */}
                <div className="flex items-center justify-center px-4 py-4 border-b border-border/60 shrink-0">
                  <DialogTitle className="text-base font-semibold text-foreground">إضافة حقل</DialogTitle>
                </div>

                {/* Search */}
                <div className="px-4 py-3 shrink-0">
                  <div className="flex items-center gap-3 h-11 px-4 bg-muted/30 rounded-2xl border border-border/60 focus-within:border-primary/40 focus-within:bg-muted/40 transition-colors">
                    <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <input
                      type="text"
                      value={fieldSearchQuery}
                      onChange={(e) => setFieldSearchQuery(e.target.value)}
                      placeholder="بحث..."
                      className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground min-w-0"
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {fieldSearchQuery.trim() ? (
                    <div className="px-4 pb-4">
                      <p className="text-xs font-medium text-muted-foreground px-1 py-2.5">نتائج البحث ({filteredFieldTypes.length})</p>
                      {filteredFieldTypes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-10">لا توجد نتائج</p>
                      ) : (
                        <div className="rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/60">
                          {filteredFieldTypes.map(({ type, icon, label, description }) => (
                            <FieldTypeButton
                              key={type}
                              icon={icon}
                              label={label}
                              description={description}
                              onClick={() => handleAddField(type)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* مقترحات */}
                      <div className="px-4 pb-3">
                        <p className="text-xs font-medium text-muted-foreground px-1 py-2.5">مقترحات</p>
                        <div className="rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/60">
                          {SUGGESTED_FIELDS.map(({ type, icon, label }) => (
                            <FieldTypeButton
                              key={`suggested-${type}`}
                              icon={icon}
                              label={label}
                              onClick={() => handleAddField(type)}
                            />
                          ))}
                        </div>
                      </div>

                      {/* اختر بنفسك */}
                      <div className="px-4 pb-4">
                        <p className="text-xs font-medium text-muted-foreground px-1 py-2.5">اختر بنفسك</p>
                        <div className="rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/60">
                          {ALL_FIELD_TYPES.map(({ type, icon, label, description }) => (
                            <FieldTypeButton
                              key={type}
                              icon={icon}
                              label={label}
                              description={description}
                              onClick={() => handleAddField(type)}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Edit Field Dialog */}
            <FieldEditDialog
              field={editingField ?? null}
              open={editingFieldId !== null}
              onOpenChange={(open) => { if (!open) setEditingFieldId(null); }}
              onUpdateField={handleUpdateField}
              onAddOption={handleAddOption}
              onUpdateOption={handleUpdateOption}
              onRemoveOption={handleRemoveOption}
            />
          </>
        )}
      </div>
    </motion.div>
  );

  // Step 4: Settings
  const renderStep4 = () => (
    <motion.div
      key="step4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center text-sm text-foreground"
    >
      {/* Step Header */}
      <WizardStepHeader step={4} totalSteps={TOTAL_STEPS} title="إعدادات النموذج" description="خصص سلوك النموذج" />

      {/* Settings List */}
      <div className="w-full max-w-md px-4 space-y-2.5">
        <SettingToggle
          title="السماح بالإرسال المتعدد"
          description="السماح للمستخدم بإرسال أكثر من رد"
          checked={allowMultipleSubmissions}
          onCheckedChange={setAllowMultipleSubmissions}
        />
        <SettingToggle
          title="يتطلب تسجيل الدخول"
          description="يجب على المستخدم تسجيل الدخول للإرسال"
          checked={requiresAuthentication}
          onCheckedChange={setRequiresAuthentication}
        />
        <SettingToggle
          title="إظهار شريط التقدم"
          description="عرض نسبة الإكمال للمستخدم"
          checked={showProgressBar}
          onCheckedChange={setShowProgressBar}
        />
        <SettingToggle
          title="ترقيم الأسئلة"
          description="عرض أرقام الأسئلة"
          checked={showQuestionNumbers}
          onCheckedChange={setShowQuestionNumbers}
        />

        {/* Notify on Submission */}
        <div className="space-y-2.5">
          <SettingToggle
            title="إشعار عند الإرسال"
            description="استلام بريد عند كل رد جديد"
            checked={notifyOnSubmission}
            onCheckedChange={setNotifyOnSubmission}
          />
          
          <AnimatePresence>
            {notifyOnSubmission && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center h-11 pr-3 border border-border rounded-xl focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all overflow-hidden bg-muted/30">
                  <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input
                    type="email"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="h-full px-3 w-full outline-none bg-transparent text-foreground placeholder:text-muted-foreground text-sm"
                    dir="ltr"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );

  // Step 5: Integrations
  const renderStep5 = () => (
    <motion.div
      key="step5"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center w-full"
    >
      {/* Step Header */}
      <WizardStepHeader step={5} totalSteps={TOTAL_STEPS} title="التكاملات الخارجية" description="اربط نموذجك بخدمات خارجية" />
      <p className="text-xs text-muted-foreground/70 mb-5 flex items-center gap-1">
        <Sparkles className="w-3 h-3" />
        اختياري — يمكنك تخطي هذه الخطوة
      </p>

      <div className="w-full max-w-md space-y-4 px-1">
        {/* Google Sheets Integration */}
        <div className={cn(
          "relative rounded-2xl border-2 transition-all duration-200 overflow-hidden",
          enableGoogleSheets 
            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10" 
            : "border-border bg-card"
        )}>
          <button
            type="button"
            onClick={() => setEnableGoogleSheets(!enableGoogleSheets)}
            className="w-full p-4 text-right"
            aria-label="تفعيل تكامل Google Sheets"
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                enableGoogleSheets 
                  ? "bg-emerald-100 dark:bg-emerald-900/30" 
                  : "bg-muted"
              )}>
                <Sheet className={cn(
                  "w-6 h-6",
                  enableGoogleSheets ? "text-emerald-600" : "text-muted-foreground"
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground">Google Sheets</h3>
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                    enableGoogleSheets 
                      ? "bg-emerald-500 border-emerald-500" 
                      : "border-muted-foreground/30"
                  )}>
                    {enableGoogleSheets && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  إرسال الردود تلقائياً إلى جدول بيانات Google
                </p>
              </div>
            </div>
          </button>
          
          {/* Features List */}
          <AnimatePresence>
            {enableGoogleSheets && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { icon: Zap, text: 'مزامنة فورية' },
                      { icon: Clock, text: 'تحديث لحظي' },
                      { icon: Share2, text: 'سهولة المشاركة' },
                      { icon: Shield, text: 'نسخ احتياطي آمن' },
                    ].map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <feature.icon className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{feature.text}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 mt-3 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" />
                    سيتم ربط الحساب بعد إنشاء النموذج
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* File Storage Options */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-medium text-foreground">تخزين الملفات المرفوعة</h3>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            اختر مكان حفظ الملفات والتوقيعات المرفوعة في النموذج
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* S3 Option */}
            <button
              type="button"
              onClick={() => setStorageOption(storageOption === 's3' ? null : 's3')}
              className={cn(
                "relative p-4 rounded-2xl border-2 text-right transition-all duration-200",
                storageOption === 's3'
                  ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10"
                  : "border-border bg-card hover:border-muted-foreground/30"
              )}
              aria-label="اختيار Amazon S3 للتخزين"
            >
              {storageOption === 's3' && (
                <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              )}
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center mb-2",
                storageOption === 's3' ? "bg-blue-100 dark:bg-blue-900/30" : "bg-muted"
              )}>
                <Cloud className={cn("w-5 h-5", storageOption === 's3' ? "text-blue-600" : "text-muted-foreground")} />
              </div>
              <h4 className="font-semibold text-sm text-foreground">Amazon S3</h4>
              <p className="text-[10px] text-muted-foreground mt-1">افتراضي — سريع وآمن</p>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-blue-500" />
                  <span>سرعة تحميل عالية</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-blue-500" />
                  <span>تشفير متقدم</span>
                </div>
              </div>
            </button>

            {/* Google Drive Option */}
            <button
              type="button"
              onClick={() => setStorageOption(storageOption === 'google_drive' ? null : 'google_drive')}
              className={cn(
                "relative p-4 rounded-2xl border-2 text-right transition-all duration-200",
                storageOption === 'google_drive'
                  ? "border-amber-500 bg-amber-50/50 dark:bg-amber-900/10"
                  : "border-border bg-card hover:border-muted-foreground/30"
              )}
              aria-label="اختيار Google Drive للتخزين"
            >
              {storageOption === 'google_drive' && (
                <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              )}
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center mb-2",
                storageOption === 'google_drive' ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"
              )}>
                <HardDrive className={cn("w-5 h-5", storageOption === 'google_drive' ? "text-amber-600" : "text-muted-foreground")} />
              </div>
              <h4 className="font-semibold text-sm text-foreground">Google Drive</h4>
              <p className="text-[10px] text-muted-foreground mt-1">مجاني — سهل المشاركة</p>
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-amber-500" />
                  <span>15GB مجاني</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CheckCircle2 className="w-3 h-3 text-amber-500" />
                  <span>تكامل Google</span>
                </div>
              </div>
            </button>
          </div>

          {storageOption === null && (
            <p className="text-[10px] text-center text-muted-foreground/60">
              سيتم استخدام التخزين الافتراضي (S3) إذا لم تختر
            </p>
          )}
        </div>

        {/* Skip Note */}
        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-2xl">
          <Sparkles className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            يمكنك تخطي هذه الخطوة وإعداد التكاملات لاحقاً من صفحة الردود
          </p>
        </div>
      </div>
    </motion.div>
  );

  // Step 6: Preview
  const renderStep6 = () => (
    <motion.div
      key="step6"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center text-sm text-foreground"
    >
      {/* Step Header */}
      <WizardStepHeader step={6} totalSteps={TOTAL_STEPS} title="معاينة النموذج" description="راجع النموذج قبل الإنشاء" />

      {/* Preview Card */}
      <div className="w-full max-w-md px-4">
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          {/* Cover Image / Banner Preview */}
          {banners.length > 0 && (
            <div className="relative h-32 overflow-hidden">
              {bannerDisplayMode === 'slider' && banners.length > 1 ? (
                <div className="flex h-full">
                  {banners.slice(0, 3).map((banner, idx) => {
                    const url = typeof banner === 'string' ? banner : URL.createObjectURL(banner);
                    return (
                      <div key={idx} className="flex-1 h-full">
                        <img src={url} alt={`Banner ${idx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    );
                  })}
                  {banners.length > 3 && (
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                      +{banners.length - 3} صور
                    </div>
                  )}
                </div>
              ) : (
                <img 
                  src={typeof banners[0] === 'string' ? banners[0] : URL.createObjectURL(banners[0])} 
                  alt="Cover" 
                  className="w-full h-full object-cover" 
                />
              )}
              <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                {bannerDisplayMode === 'slider' ? <Layers className="w-3 h-3" /> : <ImageLucide className="w-3 h-3" />}
                {bannerDisplayMode === 'slider' ? 'سلايدر' : 'صورة واحدة'}
              </div>
            </div>
          )}

          <div className="p-5">
            {/* Form Info */}
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-lg text-foreground truncate">{title || 'بدون عنوان'}</h3>
                  <span className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-full flex-shrink-0",
                    status === FormStatus.PUBLISHED ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    status === FormStatus.DRAFT ? 'bg-muted text-muted-foreground' :
                    status === FormStatus.ARCHIVED ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                    'bg-destructive/10 text-destructive'
                  )}>
                    {FORM_STATUS_LABELS[status]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description || 'بدون وصف'}</p>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <span className="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full font-medium">
                    {FORM_TYPE_LABELS[formType]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {getTotalFieldsCount()} حقول
                  </span>
                  {isMultiStep && (
                    <span className="text-xs text-muted-foreground">
                      {formSteps.length} خطوات
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Settings Summary */}
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium text-foreground mb-3">الإعدادات</h4>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", allowMultipleSubmissions ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                  <span className="text-muted-foreground">إرسال متعدد</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", requiresAuthentication ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                  <span className="text-muted-foreground">يتطلب تسجيل دخول</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", notifyOnSubmission ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                  <span className="text-muted-foreground">إشعارات البريد</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", showProgressBar ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                  <span className="text-muted-foreground">شريط التقدم</span>
                </div>
              </div>
            </div>

            {/* Integrations Summary */}
            {(enableGoogleSheets || storageOption) && (
              <div className="border-t border-border pt-4 mt-4">
                <h4 className="text-sm font-medium text-foreground mb-3">التكاملات</h4>
                <div className="space-y-2 text-xs">
                  {enableGoogleSheets && (
                    <div className="flex items-center gap-2">
                      <Sheet className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-muted-foreground">Google Sheets — مزامنة تلقائية</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {storageOption === 'google_drive' ? (
                      <>
                        <HardDrive className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-muted-foreground">التخزين: Google Drive</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-muted-foreground">التخزين: Amazon S3</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );

  // ============================================
  // Main Render
  // ============================================

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* Main Layout */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-center gap-6 lg:gap-10 min-h-[520px]">
        {/* Form Content Section */}
        <div className="flex-1 order-1 max-w-xl w-full mx-auto lg:mx-0">
          {/* Preview Button */}
          <div className="flex items-center justify-end px-4 sm:px-8 pt-4 sm:pt-6">
            <button
              type="button"
              onClick={handleGoToPreview}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/40 hover:bg-muted/60 border border-border/60 text-foreground transition-colors text-sm font-medium"
              aria-label="معاينة النموذج"
            >
              <Share2 className="w-4 h-4" />
              <span>معاينة</span>
            </button>
          </div>

          {/* Step Progress Dots - Desktop */}
          <div className="hidden lg:flex items-center justify-center mb-6">
            <div className="flex items-center gap-1">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <motion.div
                  key={i}
                  initial={false}
                  animate={{
                    width: i + 1 === currentStep ? 24 : 6,
                    opacity: i + 1 <= currentStep ? 1 : 0.3,
                  }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className={cn(
                    "h-1.5 rounded-full",
                    i + 1 <= currentStep 
                      ? "bg-foreground" 
                      : "bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums mr-2">
              {currentStep}/{TOTAL_STEPS}
            </span>
          </div>

          {/* Form Content */}
          <div className="p-4 sm:p-8">
            <AnimatePresence mode="wait">
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
              {currentStep === 5 && renderStep5()}
              {currentStep === 6 && renderStep6()}
            </AnimatePresence>
          </div>

          {/* Progress Indicator */}
          <div className="mt-8">
            <ProgressIndicator
              currentStep={currentStep}
              totalSteps={TOTAL_STEPS}
              onBack={handleBack}
              onContinue={handleContinue}
              isLoading={isSubmitting}
              isBackVisible={currentStep > 1}
              continueLabel="التالي"
              backLabel="السابق"
              finishLabel={isSubmitting ? "جاري الإنشاء..." : "إنشاء النموذج"}
              disabled={isSubmitting}
            />
          </div>
        </div>

      </div>
    </form>
  );
}

export default CreateFormWizard;
