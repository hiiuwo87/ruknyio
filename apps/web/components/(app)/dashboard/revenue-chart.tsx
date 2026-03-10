"use client";

/**
 * 📈 Revenue Chart Component
 * رسم بياني للإيرادات مع تبويبات - تصميم Snow Dashboard
 */

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

export interface ChartDataPoint {
  day: string;
  date: string;
  orders: number;
  revenue: number;
  products: number;
}

export interface RevenueChartData {
  current: ChartDataPoint[];
  previous: ChartDataPoint[];
  summary: {
    currentTotal: number;
    previousTotal: number;
    currentOrders: number;
    previousOrders: number;
  };
}

interface RevenueChartProps {
  data?: RevenueChartData;
  currentTotal?: number;
  previousTotal?: number;
}

const tabs = [
  { id: "orders", label: "إجمالي الطلبات", key: "orders" as const },
  { id: "products", label: "المنتجات", key: "products" as const },
  { id: "revenue", label: "الإيرادات", key: "revenue" as const },
];

function formatNum(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return String(num);
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string }[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-4xl border border-border/50 bg-card/95 backdrop-blur-sm px-4 py-3 text-right shadow-xl"
    >
      <p className="mb-2 text-sm font-bold text-foreground">{label}</p>
      <div className="space-y-1.5 text-xs">
        {payload.map((item, index) => (
          <p key={index} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className={cn(
                "w-2 h-2 rounded-full",
                item.dataKey === "current" ? "bg-foreground" : "bg-muted-foreground/50"
              )} />
              <span className="text-muted-foreground">
                {item.dataKey === "current" ? "الأسبوع الحالي" : "الأسبوع السابق"}
              </span>
            </span>
            <span className="font-bold text-foreground">{formatNum(item.value)}</span>
          </p>
        ))}
      </div>
    </motion.div>
  );
}

export function RevenueChart({
  data,
  currentTotal = 0,
}: RevenueChartProps) {
  const [activeTab, setActiveTab] = useState<"orders" | "products" | "revenue">("orders");

  // Transform API data to chart format
  const chartData = useMemo(() => {
    if (!data?.current || !data?.previous) {
      // Default data if no API data
      return [
        { name: "السبت", current: 0, previous: 0 },
        { name: "الأحد", current: 0, previous: 0 },
        { name: "الإثنين", current: 0, previous: 0 },
        { name: "الثلاثاء", current: 0, previous: 0 },
        { name: "الأربعاء", current: 0, previous: 0 },
        { name: "الخميس", current: 0, previous: 0 },
        { name: "الجمعة", current: 0, previous: 0 },
      ];
    }

    return data.current.map((curr, index) => ({
      name: curr.day,
      current: curr[activeTab],
      previous: data.previous[index]?.[activeTab] || 0,
    }));
  }, [data, activeTab]);

  // Calculate totals based on active tab
  const displayTotal = useMemo(() => {
    if (!data?.summary) return currentTotal;
    
    switch (activeTab) {
      case "orders":
        return data.summary.currentOrders;
      case "revenue":
        return data.summary.currentTotal;
      case "products":
        return data.current.reduce((sum, d) => sum + d.products, 0);
      default:
        return currentTotal;
    }
  }, [data, activeTab, currentTotal]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="rounded-4xl border border-border/50 bg-card p-5 sm:p-6"
    >
      {/* Header with Tabs */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                activeTab === tab.key
                  ? "text-foreground font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-foreground" />
            <span className="text-muted-foreground">الأسبوع الحالي</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-muted-foreground/50" />
            <span className="text-muted-foreground">الأسبوع السابق</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[240px] sm:h-[280px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
              dy={10}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }}
              tickFormatter={formatNum}
              dx={-10}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Previous Week - Dashed Line */}
            <Line
              type="monotone"
              dataKey="previous"
              stroke="var(--color-muted-foreground)"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--color-muted-foreground)' }}
            />
            
            {/* Current Week - Solid Line */}
            <Line
              type="monotone"
              dataKey="current"
              stroke="var(--color-foreground)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 6, fill: 'var(--color-foreground)' }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Floating Label */}
        <div className="absolute top-8 right-1/4 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-3 py-1 rounded-lg text-sm font-bold shadow-sm">
          {formatNum(displayTotal)}
        </div>
      </div>
    </motion.div>
  );
}

export function RevenueChartSkeleton() {
  return (
    <div className="rounded-4xl border border-border/50 bg-card p-5 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded-lg bg-muted animate-pulse" />
          <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
          <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="flex gap-4">
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        </div>
      </div>
      <div className="h-[240px] sm:h-[280px] bg-muted/30 rounded-xl animate-pulse" />
    </div>
  );
}
