'use client';

import { cn } from '@/lib/utils';
import { StoreStats as StatsType } from '@/lib/hooks/useStore';

interface StoreStatsProps {
  stats: StatsType;
  isLoading?: boolean;
}

const STATS_CONFIG = [
  { key: 'totalProducts', title: 'إجمالي المنتجات' },
  { key: 'activeProducts', title: 'المنتجات النشطة' },
  { key: 'draftProducts', title: 'المسودات' },
  { key: 'totalOrders', title: 'الطلبات', highlight: true },
  { key: 'totalRevenue', title: 'الإيرادات', isCurrency: true },
  { key: 'totalViews', title: 'المشاهدات' },
];

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}K`;
  return (num ?? 0).toLocaleString('en-US');
};

export function StoreStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-muted/30 p-4 sm:p-5 animate-pulse">
          <div className="h-3 w-16 bg-muted rounded mb-3" />
          <div className="h-6 w-12 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

export function StoreStats({ stats, isLoading }: StoreStatsProps) {
  if (isLoading) return <StoreStatsSkeleton />;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
      {STATS_CONFIG.map((stat) => {
        const value = stats[stat.key as keyof StatsType] || 0;

        return (
          <div
            key={stat.key}
            className={cn(
              "rounded-2xl p-4 sm:p-5",
              stat.highlight
                ? "bg-[#c8e972]/20 dark:bg-[#c8e972]/10"
                : "bg-muted/30 dark:bg-muted/20"
            )}
          >
            <p className="text-xs sm:text-sm text-muted-foreground mb-2">{stat.title}</p>
            <h3 className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
              {stat.isCurrency ? `${formatNumber(value)} د.ع` : formatNumber(value)}
            </h3>
          </div>
        );
      })}
    </div>
  );
}
