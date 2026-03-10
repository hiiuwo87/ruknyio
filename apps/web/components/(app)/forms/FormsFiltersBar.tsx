'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, SlidersHorizontal, ArrowUpDown, Filter, CheckCircle2, Clock, FileText, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  FormStatus, 
  FormsFilters,
  FormsSortOption
} from '@/lib/hooks/useForms';

interface FormsFiltersBarProps {
  filters: FormsFilters;
  onFiltersChange: (filters: FormsFilters) => void;
  sortBy: FormsSortOption;
  onSortChange: (sort: FormsSortOption) => void;
  resultsCount: number;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
}

const SORT_OPTIONS: { value: FormsSortOption; label: string; icon?: React.ElementType }[] = [
  { value: 'newest', label: 'الأحدث', icon: Clock },
  { value: 'oldest', label: 'الأقدم', icon: Clock },
  { value: 'name', label: 'أ-ي', icon: ArrowUpDown },
  { value: 'submissions', label: 'الردود', icon: FileText },
];

const STATUS_FILTERS: { value: FormStatus | ''; label: string; icon: React.ElementType; color: string }[] = [
  { value: '', label: 'الكل', icon: Filter, color: 'text-muted-foreground' },
  { value: FormStatus.PUBLISHED, label: 'منشور', icon: CheckCircle2, color: 'text-emerald-500' },
  { value: FormStatus.DRAFT, label: 'مسودة', icon: Clock, color: 'text-amber-500' },
  { value: FormStatus.CLOSED, label: 'مغلق', icon: Ban, color: 'text-rose-500' },
];

export function FormsFiltersBar({ 
  filters, 
  onFiltersChange,
  sortBy,
  onSortChange,
  resultsCount,
  viewMode,
  onViewModeChange
}: FormsFiltersBarProps) {
  const hasActiveFilters = filters.status || filters.search;

  const clearSearch = () => {
    onFiltersChange({ ...filters, search: '' });
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative group">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <input
          type="text"
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          placeholder="ابحث عن نموذج..."
          className="w-full pr-12 pl-12 py-3.5 bg-muted rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-card border border-transparent focus:border-border transition-all"
        />
        <AnimatePresence>
          {filters.search && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={clearSearch}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
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
              <motion.button
                key={status.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onFiltersChange({ 
                  ...filters, 
                  status: status.value as FormStatus || undefined 
                })}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap border",
                  isActive
                    ? "bg-foreground text-background border-foreground shadow-md"
                    : "bg-card text-muted-foreground border-border hover:border-border/80 hover:bg-muted"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", !isActive && status.color)} />
                {status.label}
              </motion.button>
            );
          })}
        </div>

        {/* Divider */}
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
              <motion.button
                key={option.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSortChange(option.value)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap border",
                  isActive
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-card text-muted-foreground border-border hover:border-border/80 hover:bg-muted"
                )}
              >
                {option.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Results Count & Clear */}
      <div className="flex items-center justify-between">
        <motion.span
          key={resultsCount}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-muted-foreground flex items-center gap-2"
        >
          <span className="inline-flex items-center justify-center w-6 h-6 bg-muted rounded-lg text-xs font-semibold text-foreground">
            {resultsCount}
          </span>
          نموذج
        </motion.span>
        
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onClick={() => onFiltersChange({})}
              className="inline-flex items-center gap-1.5 text-sm text-rose-500 hover:text-rose-600 transition-colors"
            >
              <X className="w-4 h-4" />
              مسح الفلاتر
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
