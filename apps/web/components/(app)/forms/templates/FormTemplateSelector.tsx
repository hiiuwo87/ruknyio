'use client';

import React, { useState } from 'react';
import { 
  Mail, 
  Wrench, 
  MessageSquare, 
  FileText,
  Globe,
  Check,
  ClipboardList,
  UserPlus,
  ShoppingBag,
  Star,
  HelpCircle,
  FormInput,
  Plus,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  FORM_TEMPLATES, 
  TEMPLATE_CATEGORIES,
  FormTemplate, 
  TemplateLanguage,
  TemplateCategory,
  convertTemplateToFields 
} from './templateData';
import type { FormFieldInput } from '../FieldEditor';

// ============================================
// Types
// ============================================

interface FormTemplateSelectorProps {
  selectedTemplateId: string | null;
  selectedLanguage: TemplateLanguage;
  onSelectTemplate: (templateId: string | null, fields: FormFieldInput[]) => void;
  onLanguageChange: (language: TemplateLanguage) => void;
  onStartFromScratch: () => void;
}

// ============================================
// Icon Map
// ============================================

const iconMap: Record<string, React.ElementType> = {
  'mail': Mail,
  'wrench': Wrench,
  'message-square': MessageSquare,
  'clipboard-list': ClipboardList,
  'user-plus': UserPlus,
  'shopping-bag': ShoppingBag,
  'star': Star,
  'help-circle': HelpCircle,
  'form-input': FormInput,
  'file-text': FileText,
  'calendar': CalendarDays,
};

// ============================================
// Color Map
// ============================================

const colorMap: Record<string, { bg: string; text: string; selectedBg: string }> = {
  'blue':    { bg: 'bg-blue-50',    text: 'text-blue-600',    selectedBg: 'bg-blue-600' },
  'orange':  { bg: 'bg-orange-50',  text: 'text-orange-600',  selectedBg: 'bg-orange-600' },
  'purple':  { bg: 'bg-purple-50',  text: 'text-purple-600',  selectedBg: 'bg-purple-600' },
  'amber':   { bg: 'bg-amber-50',   text: 'text-amber-600',   selectedBg: 'bg-amber-600' },
  'emerald': { bg: 'bg-emerald-50', text: 'text-emerald-600', selectedBg: 'bg-emerald-600' },
  'teal':    { bg: 'bg-teal-50',    text: 'text-teal-600',    selectedBg: 'bg-teal-600' },
  'indigo':  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  selectedBg: 'bg-indigo-600' },
  'rose':    { bg: 'bg-rose-50',    text: 'text-rose-600',    selectedBg: 'bg-rose-600' },
};

const defaultColor = { bg: 'bg-muted', text: 'text-muted-foreground', selectedBg: 'bg-foreground' };

// ============================================
// Component
// ============================================

export function FormTemplateSelector({
  selectedTemplateId,
  selectedLanguage,
  onSelectTemplate,
  onLanguageChange,
  onStartFromScratch,
}: FormTemplateSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all');

  const handleSelectTemplate = (template: FormTemplate) => {
    const fields = convertTemplateToFields(template, selectedLanguage);
    onSelectTemplate(template.id, fields as FormFieldInput[]);
  };

  const handleLanguageChange = (language: TemplateLanguage) => {
    onLanguageChange(language);
    if (selectedTemplateId) {
      const template = FORM_TEMPLATES.find(t => t.id === selectedTemplateId);
      if (template) {
        const fields = convertTemplateToFields(template, language);
        onSelectTemplate(template.id, fields as FormFieldInput[]);
      }
    }
  };

  const filteredTemplates = activeCategory === 'all'
    ? FORM_TEMPLATES
    : FORM_TEMPLATES.filter(t => t.category === activeCategory);

  return (
    <div className="space-y-4 px-1">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <h2 className="text-lg sm:text-xl font-bold text-foreground">اختر قالباً</h2>
        <p className="text-muted-foreground text-xs sm:text-sm">
          ابدأ بقالب جاهز أو أنشئ من الصفر
        </p>
        
        {/* Language Switcher */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="flex rounded-lg bg-muted p-0.5">
            <button
              type="button"
              onClick={() => handleLanguageChange('ar')}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors",
                selectedLanguage === 'ar' 
                  ? "bg-foreground text-background" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              عربي
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange('en')}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors",
                selectedLanguage === 'en' 
                  ? "bg-foreground text-background" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={cn(
            "flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            activeCategory === 'all'
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          {selectedLanguage === 'ar' ? 'الكل' : 'All'}
        </button>
        {(Object.entries(TEMPLATE_CATEGORIES) as [TemplateCategory, { ar: string; en: string }][]).map(([key, value]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveCategory(key)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              activeCategory === key
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {value[selectedLanguage]}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {/* Start from Scratch */}
        <button
          type="button"
          onClick={onStartFromScratch}
          className={cn(
            "relative rounded-xl border-2 border-dashed p-3 transition-colors flex flex-col justify-center items-center gap-2 min-h-[120px]",
            selectedTemplateId === null 
              ? "border-foreground bg-muted/40" 
              : "border-border hover:border-muted-foreground/40"
          )}
        >
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
            selectedTemplateId === null 
              ? "bg-foreground text-background" 
              : "bg-muted text-muted-foreground"
          )}>
            <Plus className="w-4 h-4" />
          </div>
          <div className="text-center">
            <h3 className="font-medium text-foreground text-xs sm:text-sm">
              من الصفر
            </h3>
            <p className="text-[10px] text-muted-foreground">
              نموذج فارغ
            </p>
          </div>
          {selectedTemplateId === null && (
            <div className="absolute top-2 left-2">
              <Check className="w-4 h-4 text-foreground" />
            </div>
          )}
        </button>

        {/* Template Cards */}
        {filteredTemplates.map((template) => {
          const isSelected = selectedTemplateId === template.id;
          const IconComponent = iconMap[template.icon] || FileText;
          const color = colorMap[template.color] || defaultColor;
          
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => handleSelectTemplate(template)}
              className={cn(
                "relative rounded-xl border p-3 transition-colors text-right min-h-[120px] flex flex-col",
                isSelected 
                  ? "border-foreground bg-muted/40" 
                  : "border-border hover:border-muted-foreground/40"
              )}
            >
              {/* Icon & Badge */}
              <div className="flex items-start justify-between mb-2">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                  isSelected ? `${color.selectedBg} text-white` : `${color.bg} ${color.text}`
                )}>
                  <IconComponent className="w-4 h-4" />
                </div>
                
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-muted text-muted-foreground">
                    {template.fields.length} حقل
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-foreground" />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3 className="font-medium text-foreground text-xs sm:text-sm line-clamp-1 mb-0.5">
                  {template.name[selectedLanguage]}
                </h3>
                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {template.description[selectedLanguage]}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Template Info */}
      {selectedTemplateId && (() => {
        const template = FORM_TEMPLATES.find(t => t.id === selectedTemplateId);
        if (!template) return null;
        const IconComponent = iconMap[template.icon] || FileText;
        const color = colorMap[template.color] || defaultColor;
        return (
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40 border border-border">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", color.selectedBg)}>
              <IconComponent className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-xs sm:text-sm">
                {template.name[selectedLanguage]}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {template.fields.length} حقول جاهزة للاستخدام
              </p>
            </div>
            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
          </div>
        );
      })()}
    </div>
  );
}

export default FormTemplateSelector;
