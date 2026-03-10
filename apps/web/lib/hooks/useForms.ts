'use client';

import { useState, useCallback } from 'react';
import { AuthClient } from '@/lib/auth/auth-client';
import { API_URL, buildApiPath } from '@/lib/config';

// ==================== ENUMS ====================

export enum FormType {
  CONTACT = 'CONTACT',
  SURVEY = 'SURVEY',
  REGISTRATION = 'REGISTRATION',
  ORDER = 'ORDER',
  FEEDBACK = 'FEEDBACK',
  QUIZ = 'QUIZ',
  APPLICATION = 'APPLICATION',
  OTHER = 'OTHER',
}

export enum FormStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  CLOSED = 'CLOSED',
}

export enum FieldType {
  // Input fields
  TEXT = 'TEXT',
  TEXTAREA = 'TEXTAREA',
  NUMBER = 'NUMBER',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  URL = 'URL',
  DATE = 'DATE',
  TIME = 'TIME',
  DATETIME = 'DATETIME',
  SELECT = 'SELECT',
  MULTISELECT = 'MULTISELECT',
  RADIO = 'RADIO',
  CHECKBOX = 'CHECKBOX',
  FILE = 'FILE',
  RATING = 'RATING',
  SCALE = 'SCALE',
  TOGGLE = 'TOGGLE',
  MATRIX = 'MATRIX',
  SIGNATURE = 'SIGNATURE',
  RANKING = 'RANKING',
  // Layout blocks
  HEADING = 'HEADING',
  PARAGRAPH = 'PARAGRAPH',
  DIVIDER = 'DIVIDER',
  TITLE = 'TITLE',
  LABEL = 'LABEL',
  // Embed blocks
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  EMBED = 'EMBED',
  // Advanced blocks
  CONDITIONAL_LOGIC = 'CONDITIONAL_LOGIC',
  CALCULATED = 'CALCULATED',
  HIDDEN = 'HIDDEN',
  RECAPTCHA = 'RECAPTCHA',
}

// ==================== INTERFACES ====================

export interface FormField {
  id: string;
  formId: string;
  stepId?: string;
  label: string;
  description?: string;
  type: FieldType;
  order: number;
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: string[] | { label: string; value: string }[];
  validationRules?: Record<string, any>;
  conditionalLogic?: Record<string, any>;
  allowedFileTypes?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  minValue?: number;
  maxValue?: number;
  minLabel?: string;
  maxLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormStep {
  id: string;
  formId: string;
  title: string;
  description?: string;
  order: number;
  fields?: FormField[];
}

export interface FormSubmission {
  id: string;
  formId: string;
  userId?: string;
  data: Record<string, any>;
  submittedAt: string;
  ipAddress?: string;
  userAgent?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface Form {
  id: string;
  userId: string;
  title: string;
  slug: string;
  description?: string;
  type: FormType;
  status: FormStatus;
  
  // Settings
  allowMultipleSubmissions: boolean;
  requiresAuthentication: boolean;
  showProgressBar: boolean;
  showQuestionNumbers: boolean;
  shuffleQuestions: boolean;
  isMultiStep: boolean;
  
  // Submission Settings
  maxSubmissions?: number;
  submissionLimit?: number;
  opensAt?: string;
  closesAt?: string;
  
  // Notifications
  notifyOnSubmission: boolean;
  notificationEmail?: string;
  autoResponseEnabled: boolean;
  autoResponseMessage?: string;
  
  // Integration
  linkedEventId?: string;
  linkedStoreId?: string;
  linkedEvent?: {
    id: string;
    title: string;
  };
  linkedStore?: {
    id: string;
    name: string;
  };
  
  // Appearance
  theme?: Record<string, any>;
  coverImage?: string;
  bannerImages?: string[];
  bannerDisplayMode?: 'single' | 'slider';
  
  // Relations
  fields?: FormField[];
  steps?: FormStep[];
  submissions?: FormSubmission[];
  user?: {
    id: string;
    email?: string;
    profile?: {
      name?: string;
      username?: string;
      avatar?: string;
      coverImage?: string;
      bio?: string;
      followersCount?: number;
      followingCount?: number;
    };
  };
  
  // Analytics
  viewCount: number;
  submissionCount: number;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  
  // Computed
  _count?: {
    submissions: number;
    fields: number;
  };
}

export interface FormsStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  totalSubmissions: number;
  totalViews: number;
}

export interface FormsFilters {
  status?: FormStatus;
  type?: FormType;
  search?: string;
  linkedEventId?: string;
  linkedStoreId?: string;
}

export type FormsSortOption = 'newest' | 'oldest' | 'name' | 'submissions' | 'views';

// ==================== ARABIC LABELS ====================

export const FORM_TYPE_LABELS: Record<FormType, string> = {
  [FormType.CONTACT]: 'تواصل',
  [FormType.SURVEY]: 'استبيان',
  [FormType.REGISTRATION]: 'تسجيل',
  [FormType.ORDER]: 'طلب',
  [FormType.FEEDBACK]: 'تقييم',
  [FormType.QUIZ]: 'اختبار',
  [FormType.APPLICATION]: 'طلب تقديم',
  [FormType.OTHER]: 'أخرى',
};

export const FORM_STATUS_LABELS: Record<FormStatus, string> = {
  [FormStatus.DRAFT]: 'مسودة',
  [FormStatus.PUBLISHED]: 'منشور',
  [FormStatus.ARCHIVED]: 'مؤرشف',
  [FormStatus.CLOSED]: 'مغلق',
};

export const FORM_STATUS_CONFIG: Record<FormStatus, { color: string; bg: string; icon: string }> = {
  [FormStatus.DRAFT]: { color: 'text-gray-600', bg: 'bg-gray-100', icon: '⚪' },
  [FormStatus.PUBLISHED]: { color: 'text-emerald-600', bg: 'bg-emerald-100', icon: '🟢' },
  [FormStatus.ARCHIVED]: { color: 'text-amber-600', bg: 'bg-amber-100', icon: '🟡' },
  [FormStatus.CLOSED]: { color: 'text-red-600', bg: 'bg-red-100', icon: '🔴' },
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  // Input fields
  [FieldType.TEXT]: 'نص قصير',
  [FieldType.TEXTAREA]: 'نص طويل',
  [FieldType.NUMBER]: 'رقم',
  [FieldType.EMAIL]: 'بريد إلكتروني',
  [FieldType.PHONE]: 'رقم هاتف',
  [FieldType.URL]: 'رابط',
  [FieldType.DATE]: 'تاريخ',
  [FieldType.TIME]: 'وقت',
  [FieldType.DATETIME]: 'تاريخ ووقت',
  [FieldType.SELECT]: 'قائمة منسدلة',
  [FieldType.MULTISELECT]: 'اختيار متعدد من قائمة',
  [FieldType.RADIO]: 'اختيار واحد',
  [FieldType.CHECKBOX]: 'اختيار متعدد',
  [FieldType.FILE]: 'رفع ملف',
  [FieldType.RATING]: 'تقييم نجوم',
  [FieldType.SCALE]: 'مقياس',
  [FieldType.TOGGLE]: 'نعم/لا',
  [FieldType.MATRIX]: 'جدول',
  [FieldType.SIGNATURE]: 'توقيع',
  [FieldType.RANKING]: 'ترتيب العناصر',
  // Layout blocks
  [FieldType.HEADING]: 'عنوان',
  [FieldType.PARAGRAPH]: 'نص توضيحي',
  [FieldType.DIVIDER]: 'فاصل',
  [FieldType.TITLE]: 'عنوان رئيسي',
  [FieldType.LABEL]: 'تسمية',
  // Embed blocks
  [FieldType.IMAGE]: 'صورة',
  [FieldType.VIDEO]: 'فيديو',
  [FieldType.AUDIO]: 'ملف صوتي',
  [FieldType.EMBED]: 'تضمين محتوى',
  // Advanced blocks
  [FieldType.CONDITIONAL_LOGIC]: 'منطق شرطي',
  [FieldType.CALCULATED]: 'حقل محسوب',
  [FieldType.HIDDEN]: 'حقل مخفي',
  [FieldType.RECAPTCHA]: 'حماية reCAPTCHA',
};

export const FORM_TYPE_CONFIG: Record<FormType, { color: string; bg: string; icon: string }> = {
  [FormType.CONTACT]: { color: 'text-blue-600', bg: 'bg-blue-100', icon: '📧' },
  [FormType.SURVEY]: { color: 'text-purple-600', bg: 'bg-purple-100', icon: '📊' },
  [FormType.REGISTRATION]: { color: 'text-green-600', bg: 'bg-green-100', icon: '📝' },
  [FormType.ORDER]: { color: 'text-orange-600', bg: 'bg-orange-100', icon: '🛒' },
  [FormType.FEEDBACK]: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: '⭐' },
  [FormType.QUIZ]: { color: 'text-pink-600', bg: 'bg-pink-100', icon: '❓' },
  [FormType.APPLICATION]: { color: 'text-indigo-600', bg: 'bg-indigo-100', icon: '📄' },
  [FormType.OTHER]: { color: 'text-gray-600', bg: 'bg-gray-100', icon: '📋' },
};

// ==================== HELPER FUNCTIONS ====================

export function filterForms(forms: Form[], filters: FormsFilters): Form[] {
  // Safety check for undefined or non-array
  if (!forms || !Array.isArray(forms)) {
    return [];
  }
  
  return forms.filter((form) => {
    // Status filter
    if (filters.status && form.status !== filters.status) {
      return false;
    }

    // Type filter
    if (filters.type && form.type !== filters.type) {
      return false;
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesTitle = form.title.toLowerCase().includes(searchLower);
      const matchesDescription = form.description?.toLowerCase().includes(searchLower);
      const matchesSlug = form.slug.toLowerCase().includes(searchLower);
      if (!matchesTitle && !matchesDescription && !matchesSlug) {
        return false;
      }
    }

    // Linked event filter
    if (filters.linkedEventId && form.linkedEventId !== filters.linkedEventId) {
      return false;
    }

    // Linked store filter
    if (filters.linkedStoreId && form.linkedStoreId !== filters.linkedStoreId) {
      return false;
    }

    return true;
  });
}

export function sortForms(forms: Form[], sortBy: FormsSortOption): Form[] {
  // Safety check for undefined or non-array
  if (!forms || !Array.isArray(forms)) {
    return [];
  }
  
  const sorted = [...forms];
  
  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case 'name':
      return sorted.sort((a, b) => a.title.localeCompare(b.title, 'ar'));
    case 'submissions':
      return sorted.sort((a, b) => (b._count?.submissions || 0) - (a._count?.submissions || 0));
    case 'views':
      return sorted.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    default:
      return sorted;
  }
}

export function calculateFormsStats(forms: Form[]): FormsStats {
  // Safety check for undefined or non-array
  if (!forms || !Array.isArray(forms)) {
    return {
      total: 0,
      published: 0,
      draft: 0,
      archived: 0,
      totalSubmissions: 0,
      totalViews: 0,
    };
  }
  
  return {
    total: forms.length,
    published: forms.filter(f => f.status === FormStatus.PUBLISHED).length,
    draft: forms.filter(f => f.status === FormStatus.DRAFT).length,
    archived: forms.filter(f => f.status === FormStatus.ARCHIVED).length,
    totalSubmissions: forms.reduce((acc, f) => acc + (f._count?.submissions || f.submissionCount || 0), 0),
    totalViews: forms.reduce((acc, f) => acc + (f.viewCount || 0), 0),
  };
}

// ==================== HOOK ====================

export function useForms() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ensure we have a valid token before making requests
  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let token = AuthClient.getToken();
    if (!token) {
      // Try to refresh the token
      const refreshed = await AuthClient.refreshTokens();
      if (refreshed) {
        token = AuthClient.getToken();
      }
    }
    return token;
  }, []);

  const getAuthHeaders = useCallback(async () => {
    const token = await ensureAuth();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [ensureAuth]);

  // Get all forms for current user
  const getMyForms = useCallback(async (filters?: FormsFilters): Promise<Form[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.linkedEventId) params.append('linkedEventId', filters.linkedEventId);
      if (filters?.linkedStoreId) params.append('linkedStoreId', filters.linkedStoreId);

      const queryString = params.toString();
      const url = `${API_URL}/forms${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('فشل في جلب النماذج');
      }

      const data = await response.json();
      // API returns { forms, pagination } structure
      return data.forms || data.data || data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء جلب النماذج';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // Get form by ID
  const getFormById = useCallback(async (id: string): Promise<Form | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/forms/${id}`, {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('فشل في جلب النموذج');
      }

      const data = await response.json();
      
      // Transform steps to have fields instead of form_fields
      if (data.steps && Array.isArray(data.steps)) {
        data.steps = data.steps.map((step: any) => ({
          ...step,
          fields: step.form_fields || step.fields || [],
        }));
      }
      
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء جلب النموذج';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // Get form by slug (public)
  const getFormBySlug = useCallback(async (slug: string): Promise<Form | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/forms/public/${slug}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('النموذج غير موجود');
      }

      const data = await response.json();
      
      // Transform steps to have fields instead of form_fields
      if (data.steps && Array.isArray(data.steps)) {
        data.steps = data.steps.map((step: any) => ({
          ...step,
          fields: step.form_fields || step.fields || [],
        }));
      }
      
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'النموذج غير موجود';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create form
  const createForm = useCallback(async (formData: Partial<Form>): Promise<Form | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/forms`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Handle NestJS validation errors (message can be string or array)
        const errorMessage = Array.isArray(errorData.message) 
          ? errorData.message.join(', ') 
          : errorData.message || 'فشل في إنشاء النموذج';
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء النموذج';
      setError(message);
      throw err; // Re-throw to propagate to caller
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // Update form
  const updateForm = useCallback(async (id: string, formData: Partial<Form>): Promise<Form | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/forms/${id}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Handle NestJS validation errors (message can be string or array)
        const errorMessage = Array.isArray(errorData.message) 
          ? errorData.message.join(', ') 
          : errorData.message || 'فشل في تحديث النموذج';
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تحديث النموذج';
      setError(message);
      throw err; // Re-throw to propagate to caller
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // Update form status
  const updateFormStatus = useCallback(async (id: string, status: FormStatus): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/forms/${id}/status`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('فشل في تحديث حالة النموذج');
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تحديث حالة النموذج';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // Delete form
  const deleteForm = useCallback(async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/forms/${id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('فشل في حذف النموذج');
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء حذف النموذج';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // Duplicate form
  const duplicateForm = useCallback(async (id: string): Promise<Form | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/forms/${id}/duplicate`, {
        method: 'POST',
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('فشل في نسخ النموذج');
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء نسخ النموذج';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // Get form submissions
  const getFormSubmissions = useCallback(async (
    formId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ submissions: FormSubmission[]; total: number }> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/forms/${formId}/submissions?page=${page}&limit=${limit}`,
        {
          method: 'GET',
          headers: await getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error('فشل في جلب الإجابات');
      }

      const data = await response.json();
      return {
        submissions: data.data || data.submissions || [],
        total: data.total || data.meta?.total || 0,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء جلب الإجابات';
      setError(message);
      return { submissions: [], total: 0 };
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // Submit form (public)
  const submitForm = useCallback(async (
    slug: string,
    data: Record<string, any>
  ): Promise<FormSubmission | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/forms/public/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في إرسال النموذج');
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء إرسال النموذج';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Export submissions
  const exportSubmissions = useCallback(async (
    formId: string,
    format: 'csv' | 'xlsx' | 'pdf' = 'csv'
  ): Promise<Blob | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/forms/${formId}/export`,
        {
          method: 'GET',
          headers: await getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في تصدير الإجابات');
      }

      // Check if response is CSV text
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/csv') || contentType?.includes('application/octet-stream')) {
        return await response.blob();
      }
      
      // If JSON response with CSV data
      const data = await response.json();
      if (data.csv) {
        return new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
      }
      
      return new Blob([JSON.stringify(data)], { type: 'text/csv;charset=utf-8;' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تصدير الإجابات';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // Get form analytics
  const getFormAnalytics = useCallback(async (formId: string): Promise<any> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/forms/${formId}/analytics`, {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('فشل في جلب التحليلات');
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء جلب التحليلات';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // Get form steps
  const getFormSteps = useCallback(async (formId: string): Promise<FormStep[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/forms/${formId}/steps`, {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error('فشل في جلب الخطوات');
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء جلب الخطوات';
      setError(message);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // Update form steps
  const updateFormSteps = useCallback(async (
    formId: string,
    steps: FormStep[]
  ): Promise<FormStep[] | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/forms/${formId}/steps`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ steps }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'فشل في تحديث الخطوات');
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تحديث الخطوات';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  return {
    // State
    isLoading,
    error,
    
    // API Functions
    getMyForms,
    getFormById,
    getFormBySlug,
    createForm,
    updateForm,
    updateFormStatus,
    deleteForm,
    duplicateForm,
    getFormSubmissions,
    submitForm,
    exportSubmissions,
    getFormAnalytics,
    getFormSteps,
    updateFormSteps,
    
    // Helper Functions
    filterForms,
    sortForms,
    calculateStats: calculateFormsStats,
  };
}
