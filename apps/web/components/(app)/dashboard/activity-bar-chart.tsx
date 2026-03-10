"use client";

/**
 * 📊 Activity Bar Chart Component
 * رسم بياني بأعمدة عمودية بتصميم نظيف
 * مستوحى من التصميم المرفق
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DayData {
  day: string;
  value: number;
  isHighlighted?: boolean;
}

interface ActivityBarChartProps {
  title?: string;
  totalValue?: string;
  totalLabel?: string;
  data?: DayData[];
  badge?: {
    value: string;
    trend?: "up" | "down";
  };
}

const defaultDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const arabicDays: Record<string, string> = {
  "Mon": "الإثنين",
  "Tue": "الثلاثاء", 
  "Wed": "الأربعاء",
  "Thu": "الخميس",
  "Fri": "الجمعة",
  "Sat": "السبت",
  "Sun": "الأحد",
};

export function ActivityBarChart({
  title = "كل الوقت",
  totalValue = "0",
  totalLabel,
  data,
  badge,
}: ActivityBarChartProps) {
  // Generate default data if not provided
  const chartData: DayData[] = data || defaultDays.map((day, i) => ({
    day,
    value: Math.floor(Math.random() * 100) + 20,
    isHighlighted: i === 3, // Thursday highlighted by default
  }));

  const maxValue = Math.max(...chartData.map(d => d.value));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl bg-muted/30 p-5 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        
        {/* Badge */}
        {badge && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border/50">
            <span className="text-sm font-medium text-foreground">{badge.value}</span>
            {badge.trend && (
              <ChevronDown className={cn(
                "w-3.5 h-3.5",
                badge.trend === "up" ? "rotate-180 text-emerald-500" : "text-rose-500"
              )} />
            )}
          </div>
        )}
      </div>

      {/* Total Value */}
      <div className="mb-6">
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
          {totalValue}
        </h2>
        {totalLabel && (
          <p className="text-sm text-muted-foreground mt-0.5">{totalLabel}</p>
        )}
      </div>

      {/* Y-Axis Labels & Chart */}
      <div className="flex gap-3">
        {/* Y-Axis Labels */}
        <div className="flex flex-col justify-between h-[140px] text-left">
          <span className="text-[10px] text-muted-foreground">6h</span>
          <span className="text-[10px] text-muted-foreground">4h</span>
          <span className="text-[10px] text-muted-foreground">2h</span>
          <span className="text-[10px] text-muted-foreground">0h</span>
        </div>

        {/* Bars Container */}
        <div className="flex-1 flex items-end justify-between gap-2 h-[140px]">
          {chartData.map((item, index) => {
            const heightPercent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
            
            return (
              <div
                key={item.day}
                className="flex-1 flex flex-col items-center gap-2"
              >
                {/* Bar */}
                <div className="w-full h-[120px] flex items-end">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(heightPercent, 10)}%` }}
                    transition={{ 
                      duration: 0.6, 
                      delay: index * 0.08, 
                      ease: "easeOut" 
                    }}
                    className={cn(
                      "w-full rounded-full relative overflow-hidden",
                      item.isHighlighted 
                        ? "bg-primary/60 dark:bg-primary/50" 
                        : "bg-muted/80 dark:bg-muted/60"
                    )}
                  >
                    {/* Diagonal stripes for highlighted bar */}
                    {item.isHighlighted && (
                      <div 
                        className="absolute inset-0 opacity-30"
                        style={{
                          backgroundImage: `repeating-linear-gradient(
                            -45deg,
                            transparent,
                            transparent 4px,
                            rgba(255,255,255,0.5) 4px,
                            rgba(255,255,255,0.5) 8px
                          )`
                        }}
                      />
                    )}
                  </motion.div>
                </div>

                {/* Day Label */}
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {arabicDays[item.day] || item.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export function ActivityBarChartSkeleton() {
  return (
    <div className="rounded-3xl bg-muted/30 p-5 sm:p-6">
      <div className="flex items-start justify-between mb-2">
        <div className="h-4 w-16 bg-muted rounded animate-pulse" />
        <div className="h-8 w-20 bg-muted rounded-full animate-pulse" />
      </div>
      <div className="h-10 w-32 bg-muted rounded animate-pulse mb-6" />
      <div className="flex gap-3">
        <div className="flex flex-col justify-between h-[140px]">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-3 w-4 bg-muted rounded animate-pulse" />
          ))}
        </div>
        <div className="flex-1 flex items-end justify-between gap-2 h-[140px]">
          {[60, 40, 50, 80, 45, 30, 55].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div 
                className="w-full bg-muted/60 rounded-full animate-pulse"
                style={{ height: `${h}%` }}
              />
              <div className="h-3 w-6 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
