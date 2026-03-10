import * as z from 'zod';

// ─── Auth Types ───────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string;
  username?: string;
  avatar?: string;
  profileCompleted?: boolean;
}

export interface AuthSession {
  user: AuthUser;
  csrfToken?: string;
  expiresIn?: number;
}

export interface StoreInfo {
  id: string;
  name: string;
  slug: string;
}

// ─── Zod Schemas ──────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z
    .string()
    .email({ message: 'يجب إدخال بريد إلكتروني صحيح' })
    .trim(),
});

export const CompleteProfileSchema = z.object({
  name: z
    .string()
    .min(2, { message: 'الاسم يجب أن يكون حرفين على الأقل' })
    .max(100, { message: 'الاسم يجب أن لا يتجاوز 100 حرف' })
    .trim(),
  username: z
    .string()
    .min(3, { message: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' })
    .max(30, { message: 'اسم المستخدم يجب أن لا يتجاوز 30 حرف' })
    .regex(/^[a-zA-Z0-9_]+$/, {
      message: 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام وشرطة سفلية فقط',
    }),
  storeCategory: z.string().optional(),
  storeDescription: z
    .string()
    .max(500, { message: 'وصف المتجر يجب أن لا يتجاوز 500 حرف' })
    .optional(),
  employeesCount: z
    .enum(['solo', '2-5', '6-10', '11-50', '50+'])
    .optional(),
  storeCountry: z.string().max(100).optional(),
  storeCity: z.string().max(100).optional(),
  storeAddress: z.string().max(500).optional(),
  storeLatitude: z.number().optional(),
  storeLongitude: z.number().optional(),
});

export const TwoFactorSchema = z.object({
  code: z
    .string()
    .length(6, { message: 'رمز التحقق يجب أن يكون 6 أرقام' })
    .regex(/^\d{6}$/, { message: 'رمز التحقق يجب أن يكون أرقاماً فقط' }),
});

export type LoginFormState = {
  errors?: { email?: string[] };
  message?: string;
  success?: boolean;
} | undefined;

export type CompleteProfileFormState = {
  errors?: {
    name?: string[];
    username?: string[];
    storeCategory?: string[];
    storeDescription?: string[];
  };
  message?: string;
  success?: boolean;
} | undefined;

// ─── Store Categories ─────────────────────────────────────────

export const STORE_CATEGORIES = [
  { value: 'fashion', label: 'أزياء وملابس' },
  { value: 'electronics', label: 'إلكترونيات' },
  { value: 'food', label: 'أغذية ومشروبات' },
  { value: 'beauty', label: 'تجميل وعناية' },
  { value: 'home', label: 'أثاث ومنزل' },
  { value: 'sports', label: 'رياضة' },
  { value: 'books', label: 'كتب ومكتبات' },
  { value: 'jewelry', label: 'مجوهرات وإكسسوارات' },
  { value: 'health', label: 'صحة ولياقة' },
  { value: 'photography', label: 'تصوير' },
  { value: 'automotive', label: 'سيارات' },
  { value: 'travel', label: 'سفر وسياحة' },
  { value: 'gifts', label: 'هدايا' },
  { value: 'pets', label: 'حيوانات أليفة' },
  { value: 'kids', label: 'أطفال' },
  { value: 'services', label: 'خدمات' },
  { value: 'handmade', label: 'أعمال يدوية' },
  { value: 'organic', label: 'منتجات عضوية' },
  { value: 'cafe', label: 'مقهى' },
  { value: 'other', label: 'أخرى' },
] as const;

export const EMPLOYEES_COUNT_OPTIONS = [
  { value: 'solo', label: 'فردي' },
  { value: '2-5', label: '2-5 موظفين' },
  { value: '6-10', label: '6-10 موظفين' },
  { value: '11-50', label: '11-50 موظف' },
  { value: '50+', label: 'أكثر من 50' },
] as const;
