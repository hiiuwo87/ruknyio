import {
  FileText,
  Mail,
  Type,
  AlignLeft,
  Hash,
  Phone,
  Calendar,
  Clock,
  List,
  CircleDot,
  CheckSquare,
  Paperclip,
  Star,
  SlidersHorizontal,
  ToggleLeft,
  Grid3X3,
  PenTool,
} from 'lucide-react';
import { FieldType } from '@/lib/hooks/useForms';

export interface FieldTypeOption {
  type: FieldType;
  icon: React.ElementType;
  label: string;
  description: string;
}

export const TOTAL_STEPS = 6;

export type StorageOption = 's3' | 'google_drive' | null;

export const SUGGESTED_FIELDS: FieldTypeOption[] = [
  { type: FieldType.TEXT, icon: Type, label: 'الاسم', description: 'حقل نص قصير' },
  { type: FieldType.PHONE, icon: Phone, label: 'رقم الهاتف', description: 'رقم هاتف مع التحقق' },
  { type: FieldType.EMAIL, icon: Mail, label: 'البريد الإلكتروني', description: 'بريد مع التحقق' },
  { type: FieldType.DATE, icon: Calendar, label: 'تاريخ الميلاد', description: 'اختيار تاريخ' },
];

export const ALL_FIELD_TYPES: FieldTypeOption[] = [
  { type: FieldType.TEXT, icon: Type, label: 'نص قصير', description: 'سطر واحد' },
  { type: FieldType.TEXTAREA, icon: AlignLeft, label: 'نص طويل', description: 'متعدد الأسطر' },
  { type: FieldType.SELECT, icon: List, label: 'قائمة منسدلة', description: 'اختيار من قائمة' },
  { type: FieldType.RADIO, icon: CircleDot, label: 'اختيار واحد', description: 'خيار واحد فقط' },
  { type: FieldType.CHECKBOX, icon: CheckSquare, label: 'اختيار متعدد', description: 'خيارات متعددة' },
  { type: FieldType.TOGGLE, icon: ToggleLeft, label: 'تبديل', description: 'نعم / لا' },
  { type: FieldType.NUMBER, icon: Hash, label: 'رقم', description: 'إدخال رقمي' },
  { type: FieldType.EMAIL, icon: Mail, label: 'بريد إلكتروني', description: 'مع التحقق' },
  { type: FieldType.PHONE, icon: Phone, label: 'هاتف', description: 'رقم هاتف' },
  { type: FieldType.DATE, icon: Calendar, label: 'تاريخ', description: 'اختيار تاريخ' },
  { type: FieldType.TIME, icon: Clock, label: 'وقت', description: 'اختيار وقت' },
  { type: FieldType.DATETIME, icon: Calendar, label: 'تاريخ ووقت', description: 'تاريخ ووقت معاً' },
  { type: FieldType.FILE, icon: Paperclip, label: 'رفع ملف', description: 'رفع مستند أو صورة' },
  { type: FieldType.RATING, icon: Star, label: 'تقييم', description: 'تقييم بالنجوم' },
  { type: FieldType.SCALE, icon: SlidersHorizontal, label: 'مقياس', description: 'مقياس رقمي' },
  { type: FieldType.MATRIX, icon: Grid3X3, label: 'جدول', description: 'جدول اختيارات' },
  { type: FieldType.SIGNATURE, icon: PenTool, label: 'توقيع', description: 'توقيع يدوي' },
];

export const getFieldTypeIcon = (type: FieldType): React.ElementType => {
  const found = ALL_FIELD_TYPES.find(f => f.type === type);
  return found?.icon || FileText;
};

export const FILE_TYPE_PRESETS: { id: string; label: string; types: string[] }[] = [
  { id: 'images', label: 'صور', types: ['image/*'] },
  { id: 'docs', label: 'مستندات', types: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
  { id: 'all', label: 'الكل', types: ['*/*'] },
];

export const SIGNATURE_PEN_COLORS = [
  { value: '#0f172a', label: 'أسود' },
  { value: '#1e40af', label: 'أزرق' },
  { value: '#166534', label: 'أخضر' },
  { value: '#991b1b', label: 'أحمر' },
];

export const FORM_PREVIEW_KEY = 'rukny_form_preview';
