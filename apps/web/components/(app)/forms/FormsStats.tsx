'use client';

/**
 * 📊 Forms Stats Component
 * بطاقات إحصائيات متناسقة مع لوحة التحكم
 */

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormsStats as StatsType } from '@/lib/hooks/useForms';

interface FormsStatsProps {
  stats: StatsType;
  isLoading?: boolean;
}

const STATS_CONFIG = [
  { key: 'total', title: 'إجمالي النماذج' },
  { key: 'published', title: 'المنشورة' },
  { key: 'totalSubmissions', title: 'الإجابات', highlight: true },
  { key: 'totalViews', title: 'المشاهدات' },
  { key: 'responseRate', title: 'معدل الاستجابة', isPercentage: true },
  { key: 'draft', title: 'المسودات' },
];

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}K`;
  return (num ?? 0).toLocaleString('en-US');
};

export function FormsStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-muted/30 p-4 sm:p-5 animate-pulse">
          <div className="h-3 w-16 bg-muted rounded mb-3" />
          <div className="h-6 w-12 bg-muted rounded mb-2" />
          <div className="h-3 w-10 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

export function FormsStats({ stats, isLoading }: FormsStatsProps) {
  const responseRate = stats.totalViews > 0 
    ? Math.round((stats.totalSubmissions / stats.totalViews) * 100) 
    : 0;

  if (isLoading) {
    return <FormsStatsSkeleton />;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
      {STATS_CONFIG.map((stat, index) => {
        const value = stat.key === 'responseRate' 
          ? responseRate 
          : (stats[stat.key as keyof StatsType] || 0);
        
        const change = 0; // يمكن إضافة حساب التغيير لاحقاً
        const trend = change >= 0 ? 'up' : 'down';
        
        return (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={cn(
              "rounded-2xl p-4 sm:p-5",
              stat.highlight 
                ? "bg-[#c8e972]/20 dark:bg-[#c8e972]/10" 
                : "bg-muted/30 dark:bg-muted/20"
            )}
          >
            {/* Title */}
            <p className="text-xs sm:text-sm text-muted-foreground mb-2">{stat.title}</p>

            {/* Value */}
            <h3 className="text-xl sm:text-2xl font-bold text-foreground tabular-nums mb-1">
              {stat.isPercentage ? `${value}%` : formatNumber(value)}
            </h3>

            {/* Change with Trend */}
            <div className="flex items-center gap-1.5">
              {trend === 'up' ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              )}
              <span className={cn(
                "text-xs font-medium",
                trend === 'up' ? "text-emerald-500" : "text-rose-500"
              )}>
                {change >= 0 ? '+' : ''}{change}%
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
