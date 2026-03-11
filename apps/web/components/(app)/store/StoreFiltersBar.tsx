'use client';

import { Search, X, SlidersHorizontal, ArrowUpDown, CheckCircle2, Clock, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProductsFilters, ProductsSortOption } from '@/lib/hooks/useStore';

interface StoreFiltersBarProps {
  filters: ProductsFilters;
  onFiltersChange: (filters: ProductsFilters) => void;
  sortBy: ProductsSortOption;
  onSortChange: (sort: ProductsSortOption) => void;
  resultsCount: number;
}

const SORT_OPTIONS: { value: ProductsSortOption; label: string }[] = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'oldest', label: 'الأقدم' },
  { value: 'name', label: 'أ-ي' },
  { value: 'price-high', label: 'السعر ↑' },
  { value: 'price-low', label: 'السعر ↓' },
];

const STATUS_FILTERS: { value: string; label: string; icon: React.ElementType; color: string }[] = [
  { value: '', label: 'الكل', icon: SlidersHorizontal, color: 'text-muted-foreground' },
  { value: 'active', label: 'نشط', icon: CheckCircle2, color: 'text-emerald-500' },
  { value: 'draft', label: 'مسودة', icon: Clock, color: 'text-amber-500' },
  { value: 'archived', label: 'مؤرشف', icon: Ban, color: 'text-rose-500' },
];

export function StoreFiltersBar({
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
  resultsCount,
}: StoreFiltersBarProps) {
  const hasActiveFilters = filters.status || filters.search;

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative group">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <input
          type="text"
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          placeholder="ابحث عن منتج..."
          className="w-full pr-12 pl-12 py-3.5 bg-muted rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-card border border-transparent focus:border-border transition-all"
        />
        {filters.search && (
          <button
            onClick={() => onFiltersChange({ ...filters, search: '' })}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground ml-1 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            الحالة:
          </span>
          {STATUS_FILTERS.map((status) => {
            const isActive = filters.status === status.value || (!filters.status && !status.value);
            const Icon = status.icon;
            return (
              <button
                key={status.value}
                onClick={() => onFiltersChange({
                  ...filters,
                  status: (status.value as ProductsFilters['status']) || undefined,
                })}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap border",
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:border-border/80 hover:bg-muted"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", !isActive && status.color)} />
                {status.label}
              </button>
            );
          })}
        </div>

        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* Sort Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground ml-1 flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            ترتيب:
          </span>
          {SORT_OPTIONS.map((option) => {
            const isActive = sortBy === option.value;
            return (
              <button
                key={option.value}
                onClick={() => onSortChange(option.value)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap border",
                  isActive
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-card text-muted-foreground border-border hover:border-border/80 hover:bg-muted"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Count & Clear */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 bg-muted rounded-lg text-xs font-semibold text-foreground">
            {resultsCount}
          </span>
          منتج
        </span>

        {hasActiveFilters && (
          <button
            onClick={() => onFiltersChange({})}
            className="inline-flex items-center gap-1.5 text-sm text-rose-500 hover:text-rose-600 transition-colors"
          >
            <X className="w-4 h-4" />
            مسح الفلاتر
          </button>
        )}
      </div>
    </div>
  );
}
