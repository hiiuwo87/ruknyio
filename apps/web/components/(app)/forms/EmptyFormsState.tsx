'use client';

import { FileText, Plus, ClipboardList, MessageSquareText, UserPlus, Star } from 'lucide-react';

interface EmptyFormsStateProps {
  onCreateForm: () => void;
}

const FORM_SUGGESTIONS = [
  { icon: MessageSquareText, label: 'استبيان رضا العملاء', color: 'text-purple-500', bg: 'bg-purple-50' },
  { icon: UserPlus, label: 'نموذج تسجيل', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { icon: Star, label: 'نموذج تقييم', color: 'text-amber-500', bg: 'bg-amber-50' },
  { icon: ClipboardList, label: 'نموذج طلب', color: 'text-blue-500', bg: 'bg-blue-50' },
];

export function EmptyFormsState({ onCreateForm }: EmptyFormsStateProps) {
  return (
    <div className="rounded-2xl bg-muted/20 p-8 sm:p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-muted flex items-center justify-center">
        <FileText className="w-8 h-8 text-muted-foreground" />
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-1.5">
        ابدأ بإنشاء نموذجك الأول
      </h3>

      <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
        أنشئ نماذج احترافية واجمع البيانات بسهولة
      </p>

      <button
        onClick={onCreateForm}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>إنشاء نموذج جديد</span>
      </button>

      <div className="mt-8 pt-6 border-t border-border">
        <p className="text-xs text-muted-foreground mb-3">أفكار للبدء</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {FORM_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.label}
              onClick={onCreateForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background hover:bg-muted rounded-lg text-xs text-muted-foreground transition-colors border border-border"
            >
              <suggestion.icon className={`w-3.5 h-3.5 ${suggestion.color}`} />
              <span>{suggestion.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
