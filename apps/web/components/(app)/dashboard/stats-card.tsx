"use client";

/**
 * 📊 Stats Card Component
 * بطاقة إحصائيات بتصميم نظيف ومينيمال
 */

import { TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  highlight?: boolean;
}

export function StatsCard({
  title,
  value,
  change,
  trend,
  highlight = false,
}: StatsCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-2xl p-4 sm:p-5",
        highlight 
          ? "bg-primary/10 dark:bg-primary/5" 
          : "bg-muted/30 dark:bg-muted/20"
      )}
    >
      {/* Title */}
      <p className="text-xs sm:text-sm text-muted-foreground mb-2">{title}</p>

      {/* Value */}
      <h3 className="text-xl sm:text-2xl font-bold text-foreground tabular-nums mb-1">
        {value}
      </h3>

      {/* Change with Trend */}
      <div className="flex items-center gap-1.5">
        {trend === "up" ? (
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
        )}
        <span className={cn(
          "text-xs font-medium",
          trend === "up" ? "text-emerald-500" : "text-rose-500"
        )}>
          {change}
        </span>
      </div>
    </motion.div>
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="rounded-2xl p-4 sm:p-5 bg-muted/30">
      <div className="h-4 w-16 bg-muted/60 rounded animate-pulse mb-2" />
      <div className="h-7 w-20 bg-muted/60 rounded animate-pulse mb-2" />
      <div className="flex items-center gap-1.5">
        <div className="h-3.5 w-3.5 bg-muted/60 rounded animate-pulse" />
        <div className="h-3 w-10 bg-muted/60 rounded animate-pulse" />
      </div>
    </div>
  );
}
