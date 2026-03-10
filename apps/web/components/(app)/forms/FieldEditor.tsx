'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { FieldType, FIELD_TYPE_LABELS } from '@/lib/hooks/useForms';
import { cn } from '@/lib/utils';

export interface FormFieldInput {
  id: string;
  label: string;
  description?: string;
  type: FieldType;
  order: number;
  required: boolean;
  placeholder?: string;
  options?: string[];
  minValue?: number;
  maxValue?: number;
  // File upload settings
  allowedFileTypes?: string[];
  maxFileSize?: number;
  maxFiles?: number;
  // Matrix (جدول اختيارات): صفوف = أسئلة، أعمدة = خيارات التقييم
  matrixRows?: string[];
  matrixColumns?: string[];
  // Signature (توقيع): لون وسُمك القلم
  signaturePenColor?: string;
  signaturePenWidth?: number;
  // Toggle (تبديل نعم/لا): نصوص العرض
  toggleLabelOn?: string;
  toggleLabelOff?: string;
}

interface FieldEditorProps {
  field: FormFieldInput;
  onUpdate: (updates: Partial<FormFieldInput>) => void;
  onClose: () => void;
}

export function FieldEditor({ field, onUpdate, onClose }: FieldEditorProps) {
  const hasOptions = field.type === FieldType.SELECT || field.type === FieldType.RADIO || field.type === FieldType.CHECKBOX;
  const hasScale = field.type === FieldType.RATING || field.type === FieldType.SCALE;
  const isFileType = field.type === FieldType.FILE;

  // Common file type presets
  const fileTypePresets = [
    { label: 'صور', types: ['image/*'], description: 'PNG, JPG, GIF, WebP' },
    { label: 'مستندات', types: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], description: 'PDF, Word' },
    { label: 'جداول', types: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'], description: 'Excel, CSV' },
    { label: 'الكل', types: ['*/*'], description: 'جميع أنواع الملفات' },
  ];

  const handleToggleFileType = (types: string[]) => {
    const current = field.allowedFileTypes || [];
    const hasAll = types.every(t => current.includes(t));
    
    if (hasAll) {
      // Remove these types
      onUpdate({ allowedFileTypes: current.filter(t => !types.includes(t)) });
    } else {
      // Add these types
      const newTypes = [...new Set([...current, ...types])];
      onUpdate({ allowedFileTypes: newTypes });
    }
  };

  const handleAddOption = () => {
    const currentOptions = field.options || [];
    onUpdate({ options: [...currentOptions, `خيار ${currentOptions.length + 1}`] });
  };

  const handleUpdateOption = (index: number, value: string) => {
    const newOptions = [...(field.options || [])];
    newOptions[index] = value;
    onUpdate({ options: newOptions });
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = (field.options || []).filter((_, i) => i !== index);
    onUpdate({ options: newOptions });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="mt-4 p-4 bg-amber-50/50 border border-amber-200 rounded-xl"
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900">
          تعديل الحقل: {FIELD_TYPE_LABELS[field.type]}
        </h4>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-amber-100 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Label */}
        <div>
          <Label htmlFor={`${field.id}-label`}>عنوان الحقل *</Label>
          <Input
            id={`${field.id}-label`}
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="أدخل عنوان الحقل"
            className="mt-1.5"
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor={`${field.id}-desc`}>وصف الحقل (اختياري)</Label>
          <Textarea
            id={`${field.id}-desc`}
            value={field.description || ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="أضف وصفاً توضيحياً للحقل..."
            className="mt-1.5 min-h-[60px]"
          />
        </div>

        {/* Placeholder */}
        {(field.type === FieldType.TEXT || 
          field.type === FieldType.TEXTAREA || 
          field.type === FieldType.EMAIL || 
          field.type === FieldType.PHONE ||
          field.type === FieldType.NUMBER) && (
          <div>
            <Label htmlFor={`${field.id}-placeholder`}>نص توضيحي (Placeholder)</Label>
            <Input
              id={`${field.id}-placeholder`}
              value={field.placeholder || ''}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              placeholder="مثال: أدخل اسمك الكامل..."
              className="mt-1.5"
            />
          </div>
        )}

        {/* Options for Select/Radio/Checkbox */}
        {hasOptions && (
          <div>
            <Label className="mb-2 block">الخيارات</Label>
            <div className="space-y-2">
              {(field.options || []).map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) => handleUpdateOption(index, e.target.value)}
                    placeholder={`خيار ${index + 1}`}
                    className="flex-1"
                  />
                  <button
                    onClick={() => handleRemoveOption(index)}
                    disabled={(field.options?.length || 0) <= 2}
                    className="p-2 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4 text-amber-600" />
                  </button>
                </div>
              ))}
              <button
                onClick={handleAddOption}
                className="flex items-center gap-1.5 text-sm text-amber-600 hover:underline"
              >
                <Plus className="w-4 h-4" />
                إضافة خيار
              </button>
            </div>
          </div>
        )}

        {/* Scale Values */}
        {hasScale && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`${field.id}-min`}>القيمة الدنيا</Label>
              <Input
                id={`${field.id}-min`}
                type="number"
                value={field.minValue || 0}
                onChange={(e) => onUpdate({ minValue: parseInt(e.target.value) || 0 })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor={`${field.id}-max`}>القيمة العليا</Label>
              <Input
                id={`${field.id}-max`}
                type="number"
                value={field.maxValue || 5}
                onChange={(e) => onUpdate({ maxValue: parseInt(e.target.value) || 5 })}
                className="mt-1.5"
              />
            </div>
          </div>
        )}

        {/* File Upload Settings */}
        {isFileType && (
          <div className="space-y-4">
            {/* Allowed File Types */}
            <div>
              <Label className="mb-2 block">أنواع الملفات المسموح بها</Label>
              <div className="flex flex-wrap gap-2">
                {fileTypePresets.map((preset) => {
                  const isSelected = preset.types.every(t => 
                    (field.allowedFileTypes || []).includes(t)
                  );
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleToggleFileType(preset.types)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm border transition-colors",
                        isSelected 
                          ? "bg-amber-100 border-amber-400 text-amber-700" 
                          : "bg-white border-gray-200 text-gray-600 hover:border-amber-300"
                      )}
                    >
                      {preset.label}
                      <span className="text-xs text-gray-400 mr-1">({preset.description})</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                {(field.allowedFileTypes || []).length === 0 
                  ? 'لم يتم تحديد أنواع - سيتم قبول جميع الملفات'
                  : `الأنواع المحددة: ${field.allowedFileTypes?.join(', ')}`
                }
              </p>
            </div>

            {/* Max File Size */}
            <div>
              <Label htmlFor={`${field.id}-maxsize`}>الحجم الأقصى للملف (MB)</Label>
              <Input
                id={`${field.id}-maxsize`}
                type="number"
                min={1}
                max={100}
                value={(field.maxFileSize || 10 * 1024 * 1024) / (1024 * 1024)}
                onChange={(e) => {
                  const mb = parseFloat(e.target.value) || 10;
                  onUpdate({ maxFileSize: mb * 1024 * 1024 });
                }}
                className="mt-1.5"
              />
            </div>

            {/* Max Files */}
            <div>
              <Label htmlFor={`${field.id}-maxfiles`}>العدد الأقصى للملفات</Label>
              <Input
                id={`${field.id}-maxfiles`}
                type="number"
                min={1}
                max={20}
                value={field.maxFiles || 1}
                onChange={(e) => onUpdate({ maxFiles: parseInt(e.target.value) || 1 })}
                className="mt-1.5"
              />
              <p className="text-xs text-gray-500 mt-1">
                {(field.maxFiles || 1) > 1 ? 'سيتمكن المستخدم من رفع ملفات متعددة' : 'ملف واحد فقط'}
              </p>
            </div>
          </div>
        )}

        {/* Required Toggle */}
        <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
          <div>
            <p className="font-medium text-sm text-gray-900">حقل إلزامي</p>
            <p className="text-xs text-gray-500">يجب على المستخدم إدخال قيمة</p>
          </div>
          <Switch
            checked={field.required}
            onCheckedChange={(checked) => onUpdate({ required: checked })}
          />
        </div>
        </div>
    </motion.div>
  );
}
