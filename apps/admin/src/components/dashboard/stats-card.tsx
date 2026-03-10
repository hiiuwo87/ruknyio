"use client";

import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon?: LucideIcon;
  highlight?: boolean;
}

export function StatsCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
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
          ? "bg-[#c8e972]/20 dark:bg-[#c8e972]/10"
          : "bg-muted/30 dark:bg-muted/20"
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs sm:text-sm text-muted-foreground mb-2">{title}</p>
        {Icon && (
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl",
            highlight ? "bg-[#c8e972]/30" : "bg-muted/50"
          )}>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      <h3 className="text-xl sm:text-2xl font-bold text-foreground tabular-nums mb-1">
        {value}
      </h3>

      <div className="flex items-center gap-1.5">
        {trend === "up" ? (
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
        )}
        <span
          className={cn(
            "text-xs font-medium",
            trend === "up" ? "text-emerald-500" : "text-rose-500"
          )}
        >
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
