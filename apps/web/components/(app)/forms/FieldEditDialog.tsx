'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldType, FIELD_TYPE_LABELS } from '@/lib/hooks/useForms';
import { cn } from '@/lib/utils';
import { type FormFieldInput } from './FieldEditor';
import { getFieldTypeIcon, FILE_TYPE_PRESETS, SIGNATURE_PEN_COLORS } from './wizard-constants';

interface FieldEditDialogProps {
  field: FormFieldInput | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateField: (id: string, updates: Partial<FormFieldInput>) => void;
  onAddOption: (fieldId: string) => void;
  onUpdateOption: (fieldId: string, index: number, value: string) => void;
  onRemoveOption: (fieldId: string, index: number) => void;
}

export function FieldEditDialog({
  field,
  open,
  onOpenChange,
  onUpdateField,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: FieldEditDialogProps) {
  if (!field) return null;

  const EditIcon = getFieldTypeIcon(field.type);
  const hasOptions = [FieldType.SELECT, FieldType.RADIO, FieldType.CHECKBOX, FieldType.RANKING].includes(field.type);
  const hasScale = field.type === FieldType.RATING || field.type === FieldType.SCALE;
  const isToggle = field.type === FieldType.TOGGLE;
  const isSignature = field.type === FieldType.SIGNATURE;
  const isMatrix = field.type === FieldType.MATRIX;
  const isFileType = field.type === FieldType.FILE;

  const inputBase = "w-full h-11 px-4 bg-muted/30 border border-border/60 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 focus:bg-background transition-all text-sm text-foreground placeholder:text-muted-foreground";
  const labelClass = "text-xs font-medium text-foreground mb-2 block";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[95vw] sm:w-[520px] sm:max-w-[90vw] rounded-[2rem] p-0 gap-0 max-h-[85vh] overflow-hidden flex flex-col border border-border/80 shadow-xl"
      >
        <div className="flex items-center justify-center px-4 py-4 border-b border-border/60 shrink-0">
          <DialogTitle className="text-base font-semibold text-foreground">تعديل الحقل</DialogTitle>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* نوع الحقل (للقراءة فقط) */}
          <div>
            <label className={labelClass}>نوع الحقل</label>
            <div className="flex items-center gap-3 h-12 px-4 bg-muted/30 border border-border/60 rounded-2xl">
              <EditIcon className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{FIELD_TYPE_LABELS[field.type]}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">لا يمكن تغيير نوع الحقل بعد الإنشاء</p>
          </div>

          {/* العنوان */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelClass}>العنوان</label>
              <span className="text-[11px] text-muted-foreground tabular-nums">{field.label.length}/200</span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={field.label}
                onChange={(e) => onUpdateField(field.id, { label: e.target.value })}
                placeholder="عنوان الحقل"
                maxLength={200}
                className={`${inputBase} pr-4 pl-20`}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-lg font-medium">
                  {FIELD_TYPE_LABELS[field.type].split(' ')[0]}
                </span>
              </div>
            </div>
          </div>

          {/* الوصف */}
          <div>
            <label className={labelClass}>
              الوصف <span className="text-muted-foreground font-normal">(اختياري)</span>
            </label>
            <textarea
              value={field.description || ''}
              onChange={(e) => onUpdateField(field.id, { description: e.target.value })}
              placeholder="وصف توضيحي للحقل..."
              rows={2}
              className="w-full p-3 bg-muted/30 border border-border/60 rounded-2xl resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 focus:bg-background transition-all text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* نص توضيحي (Placeholder) */}
          {(field.type === FieldType.TEXT ||
            field.type === FieldType.TEXTAREA ||
            field.type === FieldType.EMAIL ||
            field.type === FieldType.PHONE ||
            field.type === FieldType.NUMBER ||
            field.type === FieldType.URL ||
            field.type === FieldType.DATE ||
            field.type === FieldType.TIME ||
            field.type === FieldType.DATETIME) && (
            <div>
              <label className={labelClass}>نص توضيحي (Placeholder)</label>
              <input
                type="text"
                value={field.placeholder || ''}
                onChange={(e) => onUpdateField(field.id, { placeholder: e.target.value })}
                placeholder={
                  field.type === FieldType.DATE ? 'مثال: اختر التاريخ' :
                  field.type === FieldType.TIME ? 'مثال: اختر الوقت' :
                  field.type === FieldType.DATETIME ? 'مثال: اختر التاريخ والوقت' :
                  'مثال: أدخل اسمك الكامل...'
                }
                className={inputBase}
              />
              {(field.type === FieldType.DATE || field.type === FieldType.TIME || field.type === FieldType.DATETIME) && (
                <p className="text-[11px] text-muted-foreground mt-1.5">سيظهر للمستخدم منتقي تاريخ/وقت حسب نوع الحقل</p>
              )}
            </div>
          )}

          {/* الخيارات */}
          {hasOptions && (
            <div>
              <label className={labelClass}>الخيارات</label>
              <div className="space-y-2">
                {(field.options || []).map((option, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => onUpdateOption(field.id, idx, e.target.value)}
                      placeholder={`خيار ${idx + 1}`}
                      className="flex-1 h-10 px-3 bg-muted/30 border border-border/60 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:bg-background text-foreground transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveOption(field.id, idx)}
                      disabled={(field.options?.length || 0) <= 2}
                      className="p-2 rounded-xl hover:bg-destructive/10 transition-colors disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4 text-destructive/70" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => onAddOption(field.id)}
                  className="flex items-center gap-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors pt-1"
                >
                  <Plus className="w-4 h-4" />
                  إضافة خيار
                </button>
              </div>
            </div>
          )}

          {/* تبديل نعم/لا */}
          {isToggle && (
            <div className="space-y-3 p-4 bg-muted/20 border border-border/60 rounded-2xl">
              <p className="text-xs font-medium text-foreground">كيف يظهر التبديل للمستخدم</p>
              <div>
                <label className={labelClass}>نص عند التشغيل (نعم)</label>
                <input
                  type="text"
                  value={field.toggleLabelOn ?? 'نعم'}
                  onChange={(e) => onUpdateField(field.id, { toggleLabelOn: e.target.value })}
                  placeholder="نعم"
                  className={inputBase}
                />
              </div>
              <div>
                <label className={labelClass}>نص عند الإيقاف (لا)</label>
                <input
                  type="text"
                  value={field.toggleLabelOff ?? 'لا'}
                  onChange={(e) => onUpdateField(field.id, { toggleLabelOff: e.target.value })}
                  placeholder="لا"
                  className={inputBase}
                />
              </div>
            </div>
          )}

          {/* القيمة الدنيا/العليا (تقييم أو مقياس) */}
          {hasScale && (
            <div className="space-y-3 p-4 bg-muted/20 border border-border/60 rounded-2xl">
              <p className="text-xs font-medium text-foreground">نطاق القيم</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>القيمة الدنيا</label>
                  <input
                    type="number"
                    min={field.type === FieldType.SCALE ? undefined : 1}
                    value={field.minValue ?? (field.type === FieldType.SCALE ? 0 : 1)}
                    onChange={(e) => onUpdateField(field.id, { minValue: parseInt(e.target.value) ?? (field.type === FieldType.SCALE ? 0 : 1) })}
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className={labelClass}>القيمة العليا</label>
                  <input
                    type="number"
                    min={(field.minValue ?? (field.type === FieldType.SCALE ? 0 : 1)) + 1}
                    value={field.maxValue ?? 5}
                    onChange={(e) => onUpdateField(field.id, { maxValue: Math.max((field.minValue ?? 0) + 1, parseInt(e.target.value) || 5) })}
                    className={inputBase}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {field.type === FieldType.RATING
                  ? `سيظهر للمستخدم: من ${field.minValue ?? 1} إلى ${field.maxValue ?? 5} نجوم`
                  : `سيظهر مقياس من ${field.minValue ?? 0} إلى ${field.maxValue ?? 5}`}
              </p>
            </div>
          )}

          {/* جدول: صفوف وأعمدة */}
          {isMatrix && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>صفوف الجدول (الأسئلة أو البنود)</label>
                <div className="space-y-2">
                  {(field.matrixRows || []).map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row}
                        onChange={(e) => onUpdateField(field.id, { matrixRows: (field.matrixRows || []).map((r, i) => i === idx ? e.target.value : r) })}
                        placeholder={`صف ${idx + 1}`}
                        className="flex-1 h-10 px-3 bg-muted/30 border border-border/60 rounded-xl text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => onUpdateField(field.id, { matrixRows: (field.matrixRows || []).filter((_, i) => i !== idx) })}
                        disabled={(field.matrixRows?.length || 0) <= 1}
                        className="p-2 rounded-xl hover:bg-destructive/10 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4 text-destructive/70" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => onUpdateField(field.id, { matrixRows: [...(field.matrixRows || []), `صف ${(field.matrixRows?.length || 0) + 1}`] })}
                    className="flex items-center gap-2 text-xs font-medium text-primary"
                  >
                    <Plus className="w-4 h-4" /> إضافة صف
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}>أعمدة الجدول (خيارات التقييم)</label>
                <div className="space-y-2">
                  {(field.matrixColumns || []).map((col, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={col}
                        onChange={(e) => onUpdateField(field.id, { matrixColumns: (field.matrixColumns || []).map((c, i) => i === idx ? e.target.value : c) })}
                        placeholder={`عمود ${idx + 1}`}
                        className="flex-1 h-10 px-3 bg-muted/30 border border-border/60 rounded-xl text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => onUpdateField(field.id, { matrixColumns: (field.matrixColumns || []).filter((_, i) => i !== idx) })}
                        disabled={(field.matrixColumns?.length || 0) <= 1}
                        className="p-2 rounded-xl hover:bg-destructive/10 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4 text-destructive/70" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => onUpdateField(field.id, { matrixColumns: [...(field.matrixColumns || []), `عمود ${(field.matrixColumns?.length || 0) + 1}`] })}
                    className="flex items-center gap-2 text-xs font-medium text-primary"
                  >
                    <Plus className="w-4 h-4" /> إضافة عمود
                  </button>
                </div>
              </div>
              {/* معاينة شكل الجدول */}
              {((field.matrixRows?.length ?? 0) > 0 || (field.matrixColumns?.length ?? 0) > 0) && (
                <div className="rounded-2xl border border-border/60 overflow-hidden bg-muted/10">
                  <p className="text-[11px] font-medium text-muted-foreground px-3 py-2 border-b border-border/60">شكل الجدول كما سيظهر للمستخدم</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[200px] text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="text-right font-medium text-foreground bg-muted/30 p-2 border-b border-l border-border/60 w-24" />
                          {(field.matrixColumns || []).map((col, i) => (
                            <th key={i} className="text-center font-medium text-foreground bg-muted/30 p-2 border-b border-l border-border/60 whitespace-nowrap max-w-[80px] truncate" title={col}>
                              {col || `عمود ${i + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(field.matrixRows || []).map((row, ri) => (
                          <tr key={ri}>
                            <td className="text-right font-medium text-foreground bg-muted/20 p-2 border-b border-l border-border/60 max-w-[100px] truncate" title={row}>
                              {row || `صف ${ri + 1}`}
                            </td>
                            {(field.matrixColumns || []).map((_, ci) => (
                              <td key={ci} className="text-center p-1.5 border-b border-l border-border/60">
                                <span className="inline-flex w-5 h-5 rounded border border-border/60 bg-background" aria-hidden />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-muted-foreground px-3 py-1.5 border-t border-border/60">المستخدم يختار خياراً واحداً لكل صف</p>
                </div>
              )}
            </div>
          )}

          {/* توقيع */}
          {isSignature && (
            <div className="space-y-3 p-4 bg-muted/20 border border-border/60 rounded-2xl">
              <p className="text-xs font-medium text-foreground">تخصيص التوقيع</p>
              <p className="text-[11px] text-muted-foreground">سيظهر للمستخدم منطقة توقيع يدوي (canvas) بلون وسُمك القلم المحددين أدناه.</p>
              <div>
                <label className={labelClass}>لون القلم</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {SIGNATURE_PEN_COLORS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onUpdateField(field.id, { signaturePenColor: value })}
                      className={cn(
                        'w-9 h-9 rounded-xl border-2 transition-all',
                        (field.signaturePenColor || '#0f172a') === value ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-border'
                      )}
                      style={{ backgroundColor: value }}
                      title={label}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>سُمك القلم (1–6 px)</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={Math.min(6, Math.max(1, field.signaturePenWidth ?? 2))}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!Number.isNaN(v)) onUpdateField(field.id, { signaturePenWidth: Math.min(6, Math.max(1, v)) });
                  }}
                  className={inputBase}
                />
              </div>
            </div>
          )}

          {/* ملف: أنواع وحجم وعدد */}
          {isFileType && (
            <div className="space-y-4 p-4 bg-muted/20 border border-border/60 rounded-2xl">
              <p className="text-xs font-medium text-foreground">إعدادات رفع الملفات</p>
              <p className="text-[11px] text-muted-foreground">إذا لم تختر نوعاً محدداً، يُقبل جميع أنواع الملفات. حدد الأنواع أو اترك الافتراضي ليعمل الرفع.</p>
              <div>
                <label className={labelClass}>أنواع الملفات المقبولة</label>
                <div className="flex flex-wrap gap-2">
                  {FILE_TYPE_PRESETS.map((preset) => {
                    const current = field.allowedFileTypes?.length ? field.allowedFileTypes : ['*/*'];
                    const isSelected = preset.types.every(t => current.includes(t));
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          const raw = field.allowedFileTypes || [];
                          if (isSelected) {
                            const next = raw.filter(t => !preset.types.includes(t));
                            onUpdateField(field.id, { allowedFileTypes: next.length ? next : ['*/*'] });
                          } else {
                            const base = raw.length ? raw : ['*/*'];
                            onUpdateField(field.id, { allowedFileTypes: [...new Set([...base, ...preset.types])] });
                          }
                        }}
                        className={cn(
                          'px-3 py-2 rounded-xl text-xs font-medium border transition-colors',
                          isSelected ? 'bg-primary/10 text-primary border-primary/30' : 'bg-muted/30 border-border/60 hover:bg-muted/50'
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>الحجم الأقصى (MB)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={Math.round((field.maxFileSize || 10 * 1024 * 1024) / (1024 * 1024))}
                    onChange={(e) => onUpdateField(field.id, { maxFileSize: (parseInt(e.target.value) || 10) * 1024 * 1024 })}
                    className={inputBase}
                  />
                </div>
                <div>
                  <label className={labelClass}>العدد الأقصى للملفات</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={field.maxFiles ?? 1}
                    onChange={(e) => onUpdateField(field.id, { maxFiles: parseInt(e.target.value) || 1 })}
                    className={inputBase}
                  />
                </div>
              </div>
            </div>
          )}

          {/* حقل إلزامي */}
          <div className="flex items-center justify-between py-4 px-4 bg-muted/20 border border-border/60 rounded-2xl">
            <span className="text-sm font-medium text-foreground">حقل إلزامي</span>
            <div dir="ltr">
              <Switch
                checked={field.required}
                onCheckedChange={(checked) => onUpdateField(field.id, { required: checked })}
              />
            </div>
          </div>

          {/* زر التحديث */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-2xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            تحديث
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
