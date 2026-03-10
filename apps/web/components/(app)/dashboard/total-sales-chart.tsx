"use client";

/**
 * 🌐 Traffic by Website Chart Component
 * رسم بياني أفقي لمصادر الزيارات - تصميم Snow Dashboard
 */

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { BarChart3 } from "lucide-react";

interface TrafficSource {
  name: string;
  value: number;
  color: string;
}

interface TotalSalesChartProps {
  data?: TrafficSource[];
  totalSales?: number;
}

export function TotalSalesChart({ data }: TotalSalesChartProps) {
  // إذا لم تتوفر بيانات أو كانت فارغة
  if (!data || data.length === 0 || (data.length === 1 && data[0].value === 0)) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="rounded-4xl border border-border/50 bg-card p-5 sm:p-6"
      >
        <div className="mb-6">
          <h3 className="text-base font-bold text-foreground">مصادر الزيارات</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BarChart3 className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">لا توجد بيانات حتى الآن</p>
          <p className="text-xs mt-1">ستظهر هنا إحصائيات الزيارات والتفاعلات</p>
        </div>
      </motion.div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const totalValue = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="rounded-4xl border border-border/50 bg-card p-5 sm:p-6"
    >
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">مصادر الزيارات</h3>
        <span className="text-sm text-muted-foreground">
          {totalValue.toLocaleString()} زيارة
        </span>
      </div>

      {/* Traffic Bars */}
      <div className="space-y-4">
        {data.map((source, index) => (
          <motion.div
            key={source.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-4"
          >
            {/* Label */}
            <span className="text-sm text-muted-foreground w-20 shrink-0">
              {source.name}
            </span>
            
            {/* Bar */}
            <div className="flex-1 h-2.5 bg-muted/50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(source.value / maxValue) * 100}%` }}
                transition={{ duration: 0.8, delay: index * 0.1, ease: "easeOut" }}
                className={cn("h-full rounded-full", source.color)}
              />
            </div>

            {/* Value */}
            <span className="text-xs font-medium text-muted-foreground w-12 text-left tabular-nums">
              {source.value.toLocaleString()}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function TotalSalesChartSkeleton() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 sm:p-6">
      <div className="mb-6">
        <div className="h-5 w-28 bg-muted rounded animate-pulse" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            <div className="flex-1 h-2.5 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-muted rounded-full animate-pulse"
                style={{ width: `${Math.random() * 60 + 20}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
