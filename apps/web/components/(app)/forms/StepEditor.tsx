'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Edit2, 
  ChevronDown, 
  ChevronUp,
  Copy,
  Layers,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FieldType, FIELD_TYPE_LABELS } from '@/lib/hooks/useForms';
import { FieldTypeSelector } from './FieldTypeSelector';
import { FieldEditor, type FormFieldInput } from './FieldEditor';

export interface FormStepInput {
  id: string;
  title: string;
  description?: string;
  order: number;
  fields: FormFieldInput[];
}

interface StepEditorProps {
  steps: FormStepInput[];
  onStepsChange: (steps: FormStepInput[]) => void;
}

const reorderTransition = { type: 'spring' as const, stiffness: 300, damping: 35 };

// غلاف خطوة قابلة للسحب — كل خطوة لها useDragControls خاص
function DraggableStepItem({
  step,
  children,
}: {
  step: FormStepInput;
  children: (dragHandleProps: { onPointerDown: (e: React.PointerEvent) => void }) => React.ReactNode;
}) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item
      value={step}
      dragListener={false}
      dragControls={dragControls}
      transition={reorderTransition}
      className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm outline-none select-none focus-visible:ring-2 focus-visible:ring-amber-500/30 data-[dragging]:shadow-lg data-[dragging]:z-10"
    >
      {children({
        onPointerDown: (e: React.PointerEvent) => {
          e.preventDefault();
          e.stopPropagation();
          dragControls.start(e);
        },
      })}
    </Reorder.Item>
  );
}

export function StepEditor({ steps, onStepsChange }: StepEditorProps) {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(steps[0]?.id || null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [showFieldSelectorForStep, setShowFieldSelectorForStep] = useState<string | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  // Add new step
  const handleAddStep = () => {
    const newStep: FormStepInput = {
      id: `step-${Date.now()}`,
      title: `الخطوة ${steps.length + 1}`,
      description: '',
      order: steps.length,
      fields: [],
    };
    onStepsChange([...steps, newStep]);
    setExpandedStepId(newStep.id);
    setEditingStepId(newStep.id);
  };

  // Update step
  const handleUpdateStep = (stepId: string, updates: Partial<FormStepInput>) => {
    onStepsChange(
      steps.map(s => s.id === stepId ? { ...s, ...updates } : s)
    );
  };

  // Delete step
  const handleDeleteStep = (stepId: string) => {
    if (steps.length <= 1) {
      return; // Minimum 1 step for multi-step form
    }
    const newSteps = steps.filter(s => s.id !== stepId);
    // Reorder remaining steps
    onStepsChange(newSteps.map((s, index) => ({ ...s, order: index })));
    if (expandedStepId === stepId) {
      setExpandedStepId(newSteps[0]?.id || null);
    }
  };

  // Duplicate step
  const handleDuplicateStep = (stepId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    const newStep: FormStepInput = {
      ...step,
      id: `step-${Date.now()}`,
      title: `${step.title} (نسخة)`,
      order: steps.length,
      fields: step.fields.map(f => ({
        ...f,
        id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      })),
    };
    onStepsChange([...steps, newStep]);
  };

  // Reorder steps
  const handleReorderSteps = (newOrder: FormStepInput[]) => {
    onStepsChange(newOrder.map((s, index) => ({ ...s, order: index })));
  };

  // Add field to step
  const handleAddField = (stepId: string, fieldType: FieldType) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    const newField: FormFieldInput = {
      id: `field-${Date.now()}`,
      label: FIELD_TYPE_LABELS[fieldType],
      type: fieldType,
      order: step.fields.length,
      required: false,
      placeholder: '',
      options: fieldType === FieldType.SELECT || fieldType === FieldType.RADIO || fieldType === FieldType.CHECKBOX
        ? ['خيار 1', 'خيار 2', 'خيار 3']
        : fieldType === FieldType.RANKING
          ? ['العنصر 1', 'العنصر 2', 'العنصر 3']
          : undefined,
      minValue: fieldType === FieldType.RATING ? 1 : fieldType === FieldType.SCALE ? 0 : undefined,
      maxValue: fieldType === FieldType.RATING ? 5 : fieldType === FieldType.SCALE ? 10 : undefined,
      matrixRows: fieldType === FieldType.MATRIX ? ['صف 1', 'صف 2'] : undefined,
      matrixColumns: fieldType === FieldType.MATRIX ? ['ضعيف', 'مقبول', 'جيد', 'ممتاز'] : undefined,
      signaturePenColor: fieldType === FieldType.SIGNATURE ? '#0f172a' : undefined,
      signaturePenWidth: fieldType === FieldType.SIGNATURE ? 2 : undefined,
    };

    handleUpdateStep(stepId, {
      fields: [...step.fields, newField],
    });
    setShowFieldSelectorForStep(null);
    setEditingFieldId(newField.id);
  };

  // Update field in step
  const handleUpdateField = (stepId: string, fieldId: string, updates: Partial<FormFieldInput>) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    handleUpdateStep(stepId, {
      fields: step.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f),
    });
  };

  // Delete field from step
  const handleDeleteField = (stepId: string, fieldId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    handleUpdateStep(stepId, {
      fields: step.fields.filter(f => f.id !== fieldId),
    });
    if (editingFieldId === fieldId) {
      setEditingFieldId(null);
    }
  };

  // Duplicate field in step
  const handleDuplicateField = (stepId: string, fieldId: string) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return;

    const field = step.fields.find(f => f.id === fieldId);
    if (!field) return;

    const newField: FormFieldInput = {
      ...field,
      id: `field-${Date.now()}`,
      label: `${field.label} (نسخة)`,
      order: step.fields.length,
    };

    handleUpdateStep(stepId, {
      fields: [...step.fields, newField],
    });
  };

  // Reorder fields in step
  const handleReorderFields = (stepId: string, newOrder: FormFieldInput[]) => {
    handleUpdateStep(stepId, {
      fields: newOrder.map((f, index) => ({ ...f, order: index })),
    });
  };

  return (
    <div className="space-y-4">
      {/* Steps Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-900 font-semibold">
          <Layers className="w-5 h-5 text-amber-500" />
          خطوات النموذج
          <span className="text-sm font-normal text-gray-500">
            ({steps.length} خطوة)
          </span>
        </div>
        <button
          onClick={handleAddStep}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          إضافة خطوة
        </button>
      </div>

      {/* Steps List */}
      {steps.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl">
          <Layers className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 mb-3">لم تقم بإضافة أي خطوات بعد</p>
          <button
            onClick={handleAddStep}
            className="text-amber-500 font-medium hover:underline"
          >
            أضف خطوتك الأولى
          </button>
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={steps}
          onReorder={handleReorderSteps}
          className="space-y-3"
        >
          {steps.map((step, stepIndex) => {
            const isExpanded = expandedStepId === step.id;
            const isEditing = editingStepId === step.id;
            const editingField = editingFieldId 
              ? step.fields.find(f => f.id === editingFieldId) 
              : null;

            return (
              <DraggableStepItem key={step.id} step={step}>
                {(dragHandleProps) => (
                  <>
                {/* Step Header */}
                <div
                  className={cn(
                    "flex items-center gap-3 p-4 cursor-pointer transition-colors",
                    isExpanded ? 'bg-amber-50 border-b border-gray-200' : 'hover:bg-gray-50'
                  )}
                  onClick={() => setExpandedStepId(isExpanded ? null : step.id)}
                >
                  <div
                    className="cursor-grab active:cursor-grabbing touch-none p-1 -m-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="سحب لإعادة ترتيب الخطوة"
                    {...dragHandleProps}
                  >
                    <GripVertical className="w-5 h-5" />
                  </div>
                  
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-white text-sm font-bold">
                    {stepIndex + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={step.title}
                          onChange={(e) => handleUpdateStep(step.id, { title: e.target.value })}
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setEditingStepId(null);
                          }}
                        />
                        <button
                          onClick={() => setEditingStepId(null)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <Check className="w-4 h-4 text-emerald-500" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h4 className="font-medium text-gray-900 truncate">{step.title}</h4>
                        <p className="text-xs text-gray-500">
                          {step.fields.length} حقل
                        </p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEditingStepId(isEditing ? null : step.id)}
                      className="p-1.5 hover:bg-white rounded-lg transition-colors"
                      title="تعديل العنوان"
                    >
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDuplicateStep(step.id)}
                      className="p-1.5 hover:bg-white rounded-lg transition-colors"
                      title="تكرار الخطوة"
                    >
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                    {steps.length > 1 && (
                      <button
                        onClick={() => handleDeleteStep(step.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف الخطوة"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>

                  <div className="text-gray-400">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </div>

                {/* Step Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 space-y-4">
                        {/* Step Description */}
                        <div>
                          <Label className="text-xs text-gray-600">وصف الخطوة (اختياري)</Label>
                          <Textarea
                            value={step.description || ''}
                            onChange={(e) => handleUpdateStep(step.id, { description: e.target.value })}
                            placeholder="أدخل وصفاً للخطوة..."
                            className="mt-1 min-h-[60px] text-sm"
                          />
                        </div>

                        {/* Fields */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">حقول الخطوة</span>
                            <button
                              onClick={() => setShowFieldSelectorForStep(step.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              إضافة حقل
                            </button>
                          </div>

                          {step.fields.length === 0 ? (
                            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                              <p className="text-sm text-gray-500 mb-2">لا توجد حقول في هذه الخطوة</p>
                              <button
                                onClick={() => setShowFieldSelectorForStep(step.id)}
                                className="text-amber-500 text-sm font-medium hover:underline"
                              >
                                أضف حقل
                              </button>
                            </div>
                          ) : (
                            <Reorder.Group
                              axis="y"
                              values={step.fields}
                              onReorder={(newOrder) => handleReorderFields(step.id, newOrder)}
                              className="space-y-2"
                            >
                              {step.fields.map((field) => (
                                <Reorder.Item
                                  key={field.id}
                                  value={field}
                                  transition={reorderTransition}
                                  className={cn(
                                    "flex items-center gap-2 p-3 bg-gray-50 rounded-lg border transition-colors cursor-grab active:cursor-grabbing outline-none select-none",
                                    editingFieldId === field.id ? 'border-amber-500' : 'border-transparent',
                                    "data-[dragging]:shadow-md data-[dragging]:z-10 data-[dragging]:bg-gray-100"
                                  )}
                                >
                                  <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm truncate">{field.label}</span>
                                      {field.required && (
                                        <span className="text-xs text-red-500">*</span>
                                      )}
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {FIELD_TYPE_LABELS[field.type as FieldType]}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setEditingFieldId(editingFieldId === field.id ? null : field.id)}
                                      className="p-1 hover:bg-white rounded transition-colors"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                                    </button>
                                    <button
                                      onClick={() => handleDuplicateField(step.id, field.id)}
                                      className="p-1 hover:bg-white rounded transition-colors"
                                    >
                                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteField(step.id, field.id)}
                                      className="p-1 hover:bg-red-50 rounded transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                    </button>
                                  </div>
                                </Reorder.Item>
                              ))}
                            </Reorder.Group>
                          )}

                          {/* Field Editor */}
                          <AnimatePresence>
                            {editingField && expandedStepId === step.id && (
                              <FieldEditor
                                field={editingField}
                                onUpdate={(updates) => handleUpdateField(step.id, editingField.id, updates)}
                                onClose={() => setEditingFieldId(null)}
                              />
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                  </>
                )}
              </DraggableStepItem>
            );
          })}
        </Reorder.Group>
      )}

      {/* Field Type Selector Modal */}
      <AnimatePresence>
        {showFieldSelectorForStep && (
          <FieldTypeSelector
            onSelect={(type) => handleAddField(showFieldSelectorForStep, type)}
            onClose={() => setShowFieldSelectorForStep(null)}
          />
        )}
      </AnimatePresence>

      {/* Tip */}
      {steps.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl">
          <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            نصيحة: يمكنك سحب وإفلات الخطوات والحقول لإعادة ترتيبها. كل خطوة ستظهر في صفحة منفصلة للمستخدم.
          </p>
        </div>
      )}
    </div>
  );
}
