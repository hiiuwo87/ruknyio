'use client';

import { Package, Plus, ShoppingBag, Tag, Shirt, Sparkles } from 'lucide-react';

interface EmptyStoreStateProps {
  onCreateProduct: () => void;
}

const PRODUCT_SUGGESTIONS = [
  { icon: Shirt, label: 'ملابس وأزياء', color: 'text-purple-500' },
  { icon: Sparkles, label: 'منتجات تجميل', color: 'text-pink-500' },
  { icon: ShoppingBag, label: 'إكسسوارات', color: 'text-amber-500' },
  { icon: Tag, label: 'منتجات رقمية', color: 'text-blue-500' },
];

export function EmptyStoreState({ onCreateProduct }: EmptyStoreStateProps) {
  return (
    <div className="rounded-2xl bg-muted/20 p-8 sm:p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-muted flex items-center justify-center">
        <Package className="w-8 h-8 text-muted-foreground" />
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-1.5">
        ابدأ بإضافة منتجك الأول
      </h3>

      <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
        أضف منتجاتك وابدأ البيع عبر متجرك الإلكتروني
      </p>

      <button
        onClick={onCreateProduct}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-xl text-sm font-medium hover:bg-foreground/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>إضافة منتج جديد</span>
      </button>

      <div className="mt-8 pt-6 border-t border-border">
        <p className="text-xs text-muted-foreground mb-3">أفكار للبدء</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {PRODUCT_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.label}
              onClick={onCreateProduct}
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
