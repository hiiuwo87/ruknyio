'use client';

import React, { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  X, Type, AlignLeft, Hash, Mail, Phone, Calendar, Clock, List, CircleDot, CheckSquare,
  Paperclip, Star, SlidersHorizontal, ToggleLeft, Grid3X3, PenTool, ArrowUpDown,
  Plus, Trash2, Check, Upload, Gauge, AlertCircle, HardDrive, Layers,
} from 'lucide-react';
import { FieldType, FIELD_TYPE_LABELS } from '@/lib/hooks/useForms';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { type FormFieldInput } from './FieldEditor';

// ============================================================================
// TYPES
// ============================================================================

interface FieldTypeSelectorProps {
  onSelect: (type: FieldType) => void;
  onClose: () => void;
  /** عند الإضافة مع بيانات مكتملة (مثلاً من واجهة سريعة) */
  onSelectField?: (field: FormFieldInput) => void;
  /** وضع التحرير: عرض نموذج تعديل الحقل بدلاً من شبكة الأنواع */
  mode?: 'add' | 'edit';
  editingField?: FormFieldInput | null;
  onUpdateField?: (updates: Partial<FormFieldInput>) => void;
  onSaveField?: () => void;
}

interface FieldTypeGroup {
  title: string;
  types: {
    type: FieldType;
    icon: React.ElementType;
    description: string;
  }[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FIELD_GROUPS: FieldTypeGroup[] = [
  {
    title: 'حقول نصية',
    types: [
      { type: FieldType.TEXT, icon: Type, description: 'نص قصير في سطر واحد' },
      { type: FieldType.TEXTAREA, icon: AlignLeft, description: 'نص طويل متعدد الأسطر' },
      { type: FieldType.EMAIL, icon: Mail, description: 'بريد إلكتروني مع التحقق' },
      { type: FieldType.PHONE, icon: Phone, description: 'رقم هاتف' },
    ],
  },
  {
    title: 'أرقام وتواريخ',
    types: [
      { type: FieldType.NUMBER, icon: Hash, description: 'إدخال رقمي' },
      { type: FieldType.DATE, icon: Calendar, description: 'اختيار تاريخ' },
      { type: FieldType.TIME, icon: Clock, description: 'اختيار وقت' },
      { type: FieldType.DATETIME, icon: Calendar, description: 'تاريخ ووقت معاً' },
    ],
  },
  {
    title: 'اختيارات',
    types: [
      { type: FieldType.SELECT, icon: List, description: 'قائمة منسدلة' },
      { type: FieldType.RADIO, icon: CircleDot, description: 'اختيار واحد من متعدد' },
      { type: FieldType.CHECKBOX, icon: CheckSquare, description: 'اختيار متعدد' },
      { type: FieldType.TOGGLE, icon: ToggleLeft, description: 'نعم/لا' },
    ],
  },
  {
    title: 'متقدمة',
    types: [
      { type: FieldType.FILE, icon: Paperclip, description: 'رفع ملف' },
      { type: FieldType.RATING, icon: Star, description: 'تقييم بالنجوم' },
      { type: FieldType.SCALE, icon: SlidersHorizontal, description: 'مقياس رقمي' },
      { type: FieldType.MATRIX, icon: Grid3X3, description: 'جدول اختيارات' },
      { type: FieldType.SIGNATURE, icon: PenTool, description: 'توقيع يدوي' },
      { type: FieldType.RANKING, icon: ArrowUpDown, description: 'ترتيب العناصر' },
    ],
  },
];

const STYLES = {
  input: 'h-9 rounded-lg border-border bg-muted/40 focus:bg-background text-sm transition-colors',
  label: 'text-xs font-medium text-foreground block',
  hint: 'text-[11px] text-muted-foreground mb-1',
  card: 'p-3 rounded-lg border border-border bg-card',
  iconBox: 'size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0',
  iconBoxSm: 'size-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0',
} as const;

const fieldTypeIcons: Partial<Record<FieldType, React.ReactNode>> = {
  [FieldType.TEXT]: <Type className="size-4" />,
  [FieldType.TEXTAREA]: <AlignLeft className="size-4" />,
  [FieldType.NUMBER]: <Hash className="size-4" />,
  [FieldType.EMAIL]: <Mail className="size-4" />,
  [FieldType.PHONE]: <Phone className="size-4" />,
  [FieldType.SELECT]: <List className="size-4" />,
  [FieldType.RADIO]: <CircleDot className="size-4" />,
  [FieldType.CHECKBOX]: <CheckSquare className="size-4" />,
  [FieldType.RATING]: <Star className="size-4" />,
  [FieldType.SCALE]: <Gauge className="size-4" />,
  [FieldType.FILE]: <Upload className="size-4" />,
  [FieldType.MATRIX]: <Grid3X3 className="size-4" />,
  [FieldType.SIGNATURE]: <PenTool className="size-4" />,
  [FieldType.RANKING]: <ArrowUpDown className="size-4" />,
};

const SIGNATURE_PEN_COLORS = [
  { value: '#0f172a', label: 'أسود' },
  { value: '#1e40af', label: 'أزرق' },
  { value: '#166534', label: 'أخضر' },
  { value: '#991b1b', label: 'أحمر' },
];

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function SectionHeader({
  icon,
  title,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className={STYLES.iconBoxSm}>{icon}</div>
      <span className="text-sm font-medium text-foreground flex-1">{title}</span>
      {badge && (
        <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
          {badge}
        </span>
      )}
    </div>
  );
}

function OptionRow({
  index,
  value,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="group flex items-center gap-2 px-3 py-2.5 bg-muted/30 hover:bg-muted/50 rounded-xl transition-colors">
      <span className="size-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
        {index + 1}
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 border-0 bg-transparent h-9 text-sm font-medium placeholder:text-muted-foreground"
        placeholder={`خيار ${index + 1}`}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className={cn(
          'size-8 flex items-center justify-center rounded-lg transition-all shrink-0',
          'bg-destructive/10 hover:bg-destructive/20',
          'opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-not-allowed'
        )}
      >
        <Trash2 className="size-4 text-destructive" />
      </button>
    </div>
  );
}

// ============================================================================
// EDIT MODE CONTENT
// ============================================================================

function FieldEditorContent({
  field,
  onUpdate,
}: {
  field: FormFieldInput;
  onUpdate: (updates: Partial<FormFieldInput>) => void;
}) {
  const hasOptions = [FieldType.SELECT, FieldType.RADIO, FieldType.CHECKBOX, FieldType.MULTISELECT, FieldType.RANKING].includes(field.type);
  const hasScale = [FieldType.RATING, FieldType.SCALE].includes(field.type);
  const isFileType = field.type === FieldType.FILE;
  const isMatrix = field.type === FieldType.MATRIX;
  const isSignature = field.type === FieldType.SIGNATURE;
  const hasPlaceholder = [
    FieldType.TEXT, FieldType.TEXTAREA, FieldType.EMAIL, FieldType.PHONE,
    FieldType.NUMBER, FieldType.URL,
  ].includes(field.type);

  const handleAddOption = useCallback(() => {
    const current = field.options || [];
    onUpdate({ options: [...current, `خيار ${current.length + 1}`] });
  }, [field.options, onUpdate]);

  const handleUpdateOption = useCallback((index: number, value: string) => {
    const newOptions = [...(field.options || [])];
    newOptions[index] = value;
    onUpdate({ options: newOptions });
  }, [field.options, onUpdate]);

  const handleRemoveOption = useCallback((index: number) => {
    const newOptions = (field.options || []).filter((_, i) => i !== index);
    onUpdate({ options: newOptions });
  }, [field.options, onUpdate]);

  const handleAddMatrixRow = useCallback(() => {
    const current = field.matrixRows || [];
    onUpdate({ matrixRows: [...current, `صف ${current.length + 1}`] });
  }, [field.matrixRows, onUpdate]);

  const handleUpdateMatrixRow = useCallback((index: number, value: string) => {
    const rows = [...(field.matrixRows || [])];
    rows[index] = value;
    onUpdate({ matrixRows: rows });
  }, [field.matrixRows, onUpdate]);

  const handleRemoveMatrixRow = useCallback((index: number) => {
    const rows = (field.matrixRows || []).filter((_, i) => i !== index);
    onUpdate({ matrixRows: rows });
  }, [field.matrixRows, onUpdate]);

  const handleAddMatrixColumn = useCallback(() => {
    const current = field.matrixColumns || [];
    onUpdate({ matrixColumns: [...current, `عمود ${current.length + 1}`] });
  }, [field.matrixColumns, onUpdate]);

  const handleUpdateMatrixColumn = useCallback((index: number, value: string) => {
    const cols = [...(field.matrixColumns || [])];
    cols[index] = value;
    onUpdate({ matrixColumns: cols });
  }, [field.matrixColumns, onUpdate]);

  const handleRemoveMatrixColumn = useCallback((index: number) => {
    const cols = (field.matrixColumns || []).filter((_, i) => i !== index);
    onUpdate({ matrixColumns: cols });
  }, [field.matrixColumns, onUpdate]);

  return (
    <div className="p-3 space-y-3">
      {/* عنوان ووصف */}
      <div>
        <label className={cn(STYLES.label, 'mb-1.5')}>عنوان الحقل <span className="text-destructive">*</span></label>
        <Input
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="أدخل عنوان الحقل"
          className={STYLES.input}
        />
      </div>
      <div>
        <label className={STYLES.label}>الوصف <span className="text-muted-foreground text-xs">(اختياري)</span></label>
        <textarea
          value={field.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="وصف توضيحي..."
          rows={2}
          className={cn('w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-muted/40 focus:bg-background focus:ring-2 focus:ring-primary/20 outline-none resize-none', 'text-foreground placeholder:text-muted-foreground')}
        />
      </div>
      {hasPlaceholder && (
        <div>
          <label className={STYLES.label}>نص توضيحي (Placeholder)</label>
          <Input
            value={field.placeholder || ''}
            onChange={(e) => onUpdate({ placeholder: e.target.value })}
            placeholder="مثال: أدخل هنا..."
            className={STYLES.input}
          />
        </div>
      )}

      {/* اختيارات: Select, Radio, Checkbox, Ranking */}
      {hasOptions && (
        <div className="space-y-3">
          <SectionHeader
            icon={fieldTypeIcons[field.type]}
            title={FIELD_TYPE_LABELS[field.type]}
            badge={`${field.options?.length || 0} خيار`}
          />
          <div className={cn(STYLES.card, 'p-0 overflow-hidden')}>
            <div className="p-2 max-h-40 overflow-y-auto space-y-1.5">
              {(field.options || []).map((opt, i) => (
                <OptionRow
                  key={i}
                  index={i}
                  value={opt}
                  onChange={(v) => handleUpdateOption(i, v)}
                  onRemove={() => handleRemoveOption(i)}
                  canRemove={(field.options?.length || 0) > 2}
                />
              ))}
            </div>
            <div className="p-2 border-t border-border bg-muted/20">
              <button
                type="button"
                onClick={handleAddOption}
                className={cn(
                  'flex items-center justify-center gap-2 w-full py-3 text-sm font-medium',
                  'text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors',
                  'border border-dashed border-primary/30 hover:border-primary/50'
                )}
              >
                <Plus className="size-4" />
                إضافة خيار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مقياس: Rating / Scale */}
      {hasScale && (
        <div className="space-y-3">
          <SectionHeader
            icon={field.type === FieldType.RATING ? <Star className="size-4" /> : <Gauge className="size-4" />}
            title={field.type === FieldType.RATING ? 'تقييم بالنجوم' : 'مقياس رقمي'}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={STYLES.hint}>الحد الأدنى</label>
              <Input
                type="number"
                value={field.minValue ?? (field.type === FieldType.SCALE ? 0 : 1)}
                onChange={(e) => onUpdate({ minValue: parseInt(e.target.value) || 0 })}
                className={cn(STYLES.input, 'text-center font-bold')}
              />
            </div>
            <div>
              <label className={STYLES.hint}>الحد الأقصى</label>
              <Input
                type="number"
                value={field.maxValue ?? 5}
                onChange={(e) => onUpdate({ maxValue: parseInt(e.target.value) || 5 })}
                className={cn(STYLES.input, 'text-center font-bold')}
              />
            </div>
          </div>
        </div>
      )}

      {/* ملف */}
      {isFileType && (
        <div className="space-y-3">
          <SectionHeader icon={<Upload className="size-4" />} title="إعدادات الملفات" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={STYLES.hint}>الحجم الأقصى (MB)</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={((field.maxFileSize ?? 10 * 1024 * 1024) / (1024 * 1024)) | 0}
                onChange={(e) => onUpdate({ maxFileSize: (parseFloat(e.target.value) || 10) * 1024 * 1024 })}
                className={cn(STYLES.input, 'text-center font-bold')}
              />
            </div>
            <div>
              <label className={STYLES.hint}>العدد الأقصى</label>
              <Input
                type="number"
                min={1}
                max={20}
                value={field.maxFiles ?? 1}
                onChange={(e) => onUpdate({ maxFiles: parseInt(e.target.value) || 1 })}
                className={cn(STYLES.input, 'text-center font-bold')}
              />
            </div>
          </div>
        </div>
      )}

      {/* جدول (Matrix): صفوف وأعمدة */}
      {isMatrix && (
        <div className="space-y-4">
          <SectionHeader icon={<Grid3X3 className="size-4" />} title="جدول الاختيارات" badge="صفوف × أعمدة" />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">صفوف الجدول (أسئلة أو بنود)</p>
            <div className={cn(STYLES.card, 'p-0 overflow-hidden')}>
              <div className="p-2 max-h-32 overflow-y-auto space-y-1.5">
                {(field.matrixRows || []).map((row, i) => (
                  <OptionRow
                    key={i}
                    index={i}
                    value={row}
                    onChange={(v) => handleUpdateMatrixRow(i, v)}
                    onRemove={() => handleRemoveMatrixRow(i)}
                    canRemove={(field.matrixRows?.length || 0) > 1}
                  />
                ))}
              </div>
              <div className="p-2 border-t border-border bg-muted/20">
                <button
                  type="button"
                  onClick={handleAddMatrixRow}
                  className={cn(
                    'flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium',
                    'text-primary bg-primary/5 hover:bg-primary/10 rounded-xl border border-dashed border-primary/30'
                  )}
                >
                  <Plus className="size-4" />
                  إضافة صف
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">أعمدة الجدول (خيارات التقييم)</p>
            <div className={cn(STYLES.card, 'p-0 overflow-hidden')}>
              <div className="p-2 max-h-32 overflow-y-auto space-y-1.5">
                {(field.matrixColumns || []).map((col, i) => (
                  <OptionRow
                    key={i}
                    index={i}
                    value={col}
                    onChange={(v) => handleUpdateMatrixColumn(i, v)}
                    onRemove={() => handleRemoveMatrixColumn(i)}
                    canRemove={(field.matrixColumns?.length || 0) > 1}
                  />
                ))}
              </div>
              <div className="p-2 border-t border-border bg-muted/20">
                <button
                  type="button"
                  onClick={handleAddMatrixColumn}
                  className={cn(
                    'flex items-center justify-center gap-2 w-full py-2.5 text-sm font-medium',
                    'text-primary bg-primary/5 hover:bg-primary/10 rounded-xl border border-dashed border-primary/30'
                  )}
                >
                  <Plus className="size-4" />
                  إضافة عمود
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* توقيع (Signature) */}
      {isSignature && (
        <div className="space-y-3">
          <SectionHeader icon={<PenTool className="size-4" />} title="تخصيص التوقيع" />
          <div className={STYLES.card}>
            <div className="space-y-3">
              <div>
                <label className={STYLES.hint}>لون القلم</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {SIGNATURE_PEN_COLORS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onUpdate({ signaturePenColor: value })}
                      className={cn(
                        'size-9 rounded-xl border-2 transition-all',
                        (field.signaturePenColor || '#0f172a') === value
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-transparent hover:border-border'
                      )}
                      style={{ backgroundColor: value }}
                      title={label}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className={STYLES.hint}>سُمك القلم (px)</label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={field.signaturePenWidth ?? 2}
                  onChange={(e) => onUpdate({ signaturePenWidth: Math.min(6, Math.max(1, parseInt(e.target.value) || 2)) })}
                  className={cn(STYLES.input, 'text-center font-bold')}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مطلوب */}
      <div
        className={cn(
          STYLES.card,
          'flex items-center justify-between',
          field.required && 'bg-destructive/5 border-destructive/20'
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              STYLES.iconBoxSm,
              field.required ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'
            )}
          >
            <AlertCircle className="size-4" />
          </div>
          <div>
            <p className={cn('font-medium text-sm', field.required ? 'text-destructive' : 'text-foreground')}>
              حقل إلزامي
            </p>
            <p className="text-xs text-muted-foreground">
              {field.required ? 'المستخدم ملزم بتعبئة هذا الحقل' : 'هذا الحقل اختياري'}
            </p>
          </div>
        </div>
        <Switch checked={field.required} onCheckedChange={(c) => onUpdate({ required: c })} />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FieldTypeSelector({
  onSelect,
  onClose,
  onSelectField,
  mode = 'add',
  editingField,
  onUpdateField,
  onSaveField,
}: FieldTypeSelectorProps) {
  const isEditMode = mode === 'edit' && editingField != null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden bg-card border border-border rounded-2xl shadow-xl',
          'inset-x-3 top-[12%] max-h-[78vh] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2',
          'w-[calc(100vw-1.5rem)] sm:w-[440px] sm:max-h-[70vh]'
        )}
      >
        {/* Header - compact */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
          {isEditMode && editingField ? (
            <>
              <div className="flex items-center gap-3">
                <div className={STYLES.iconBox}>
                  {fieldTypeIcons[editingField.type] ?? <Type className="size-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">تعديل الحقل</h3>
                  <p className="text-[11px] text-muted-foreground">{FIELD_TYPE_LABELS[editingField.type]}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5" dir="ltr">
                <Button variant="ghost" size="sm" onClick={onClose} className="h-8 rounded-lg text-xs">
                  إلغاء
                </Button>
                <Button size="sm" onClick={() => onSaveField?.()} className="h-8 rounded-lg gap-1 text-xs">
                  <Check className="size-4" />
                  حفظ
                </Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-foreground">إضافة حقل</h3>
          <button
                type="button"
            onClick={onClose}
                className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                aria-label="إغلاق"
          >
                <X className="w-4 h-4" />
          </button>
            </>
          )}
        </div>
        
        {/* Content */}
        {isEditMode && editingField && onUpdateField ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <FieldEditorContent field={editingField} onUpdate={onUpdateField} />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
            {FIELD_GROUPS.map((group, gi) => (
              <motion.div
                key={group.title}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.02, duration: 0.15 }}
              >
                <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 px-0.5">
                  {group.title}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {group.types.map(({ type, icon: Icon, description }) => (
                  <motion.button
                    key={type}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelect(type)}
                      className={cn(
                        'flex items-center gap-2 p-2 text-right rounded-lg border transition-all duration-150',
                        'bg-muted/20 hover:bg-muted/40 border-border hover:border-primary/25',
                        'focus:outline-none focus:ring-1 focus:ring-primary/20'
                      )}
                    >
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                        <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs text-foreground leading-tight">{FIELD_TYPE_LABELS[type]}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{description}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
              </motion.div>
          ))}
        </div>
        )}
      </motion.div>
    </>
  );
}
