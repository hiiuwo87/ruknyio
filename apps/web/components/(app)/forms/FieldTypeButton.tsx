'use client';

import { Plus } from 'lucide-react';

interface FieldTypeButtonProps {
  icon: React.ElementType;
  label: string;
  description?: string;
  onClick: () => void;
}

export function FieldTypeButton({ icon: Icon, label, description, onClick }: FieldTypeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 py-3.5 px-4 hover:bg-muted/30 active:bg-muted/40 transition-colors text-right rounded-none first:rounded-t-2xl last:rounded-b-2xl"
    >
      <span className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 text-foreground">
        <Icon className="w-5 h-5" />
      </span>
      <div className="flex-1 min-w-0 text-right">
        <p className="font-medium text-sm text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{description}</p>
        )}
      </div>
      <span className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
        <Plus className="w-4 h-4" />
      </span>
    </button>
  );
}
