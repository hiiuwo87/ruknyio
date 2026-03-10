"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, BarChart3, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatItem {
  label: string;
  value: string | number;
  change: number;
  highlight?: boolean;
}

interface OverviewStatsProps {
  title?: string;
  subtitle?: string;
  stats: StatItem[];
}

export function OverviewStats({
  title = "Platform Overview",
  subtitle = "Real-time statistics across all services",
  stats,
}: OverviewStatsProps) {
  const values = stats.map((s) =>
    typeof s.value === "number"
      ? s.value
      : parseInt(s.value.toString().replace(/,/g, "")) || 0
  );
  const maxValue = Math.max(...values);
  const allEqual = values.every((v) => v === values[0]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl bg-muted/30 p-5 sm:p-6"
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-xl hover:bg-muted/50 transition-colors">
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
          <button className="p-2 rounded-xl hover:bg-muted/50 transition-colors">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex items-end justify-between gap-3 h-[180px]">
        {stats.map((stat, index) => {
          const numValue =
            typeof stat.value === "number"
              ? stat.value
              : parseInt(stat.value.toString().replace(/,/g, "")) || 0;
          const heightPercent = allEqual
            ? 50
            : maxValue > 0
              ? (numValue / maxValue) * 100
              : 50;

          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex-1 flex flex-col items-center"
            >
              <div
                className="relative w-full flex flex-col items-center justify-end"
                style={{ height: "140px" }}
              >
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(heightPercent, 30)}%` }}
                  transition={{
                    duration: 0.6,
                    delay: index * 0.1,
                    ease: "easeOut",
                  }}
                  className={cn(
                    "w-full rounded-2xl flex flex-col items-center justify-start pt-2 px-1 min-h-[50px]",
                    stat.highlight
                      ? "bg-[#c8e972] dark:bg-[#b8d962]"
                      : "bg-muted/50 dark:bg-muted/30"
                  )}
                >
                  <span
                    className={cn(
                      "text-[9px] sm:text-[10px] whitespace-nowrap mb-0.5",
                      stat.highlight
                        ? "text-foreground/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {stat.label}
                  </span>
                  <span
                    className={cn(
                      "text-sm sm:text-base font-bold",
                      stat.highlight ? "text-foreground" : "text-foreground"
                    )}
                  >
                    {typeof stat.value === "number"
                      ? stat.value.toLocaleString()
                      : stat.value}
                  </span>
                </motion.div>
              </div>

              <div className="flex items-center gap-1 mt-2">
                {stat.change >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-rose-500" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    stat.change >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}
                >
                  {stat.change >= 0 ? "+" : ""}
                  {stat.change}%
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function OverviewStatsSkeleton() {
  return (
    <div className="rounded-3xl bg-muted/30 p-5 sm:p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-5 w-24 bg-muted rounded animate-pulse" />
          <div className="h-4 w-48 bg-muted rounded animate-pulse mt-2" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-muted rounded-xl animate-pulse" />
          <div className="w-8 h-8 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
      <div className="flex items-end justify-between gap-3 h-[180px]">
        {[65, 45, 100, 55].map((height, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-muted/60 rounded-2xl animate-pulse"
              style={{ height: `${height}%` }}
            />
            <div className="flex items-center gap-1 mt-2">
              <div className="h-3 w-3 bg-muted rounded animate-pulse" />
              <div className="h-3 w-8 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
