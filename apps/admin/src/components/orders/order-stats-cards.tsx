"use client";

/**
 * 📊 Order Stats Cards
 * Dashboard-style stats overview for orders
 */

import {
  TrendingUp,
  TrendingDown,
  type LucideIcon,
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface OrderStatsData {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  byStatus: {
    pending: number;
    confirmed: number;
    processing: number;
    shipped: number;
    outForDelivery: number;
    delivered: number;
    cancelled: number;
    refunded: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    today: number;
  };
  averageOrderValue: number;
  cancellationRate: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return (n ?? 0).toLocaleString("en-US");
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M IQD`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K IQD`;
  return `${(n ?? 0).toLocaleString("en-US")} IQD`;
}

export function OrderStatsCards({ stats }: { stats: OrderStatsData }) {
  const cards: Array<{
    title: string;
    value: string;
    change: string;
    trend: "up" | "down";
    icon: LucideIcon;
    highlight?: boolean;
  }> = [
    {
      title: "Total Orders",
      value: formatNumber(stats.total),
      change: `+${stats.thisMonth} this month`,
      trend: "up",
      icon: ShoppingBag,
      highlight: true,
    },
    {
      title: "Today",
      value: formatNumber(stats.today),
      change: `${stats.thisWeek} this week`,
      trend: stats.today > 0 ? "up" : "down",
      icon: Clock,
    },
    {
      title: "Revenue",
      value: formatCurrency(stats.revenue.total),
      change: `${formatCurrency(stats.revenue.thisMonth)} this month`,
      trend: "up",
      icon: DollarSign,
    },
    {
      title: "Delivered",
      value: formatNumber(stats.byStatus.delivered),
      change: `${stats.total > 0 ? Math.round((stats.byStatus.delivered / stats.total) * 100) : 0}% completion`,
      trend: "up",
      icon: CheckCircle,
    },
    {
      title: "Cancelled",
      value: formatNumber(stats.byStatus.cancelled),
      change: `${stats.cancellationRate}% rate`,
      trend: stats.byStatus.cancelled > 0 ? "down" : "up",
      icon: XCircle,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className={cn(
            "rounded-2xl p-4 sm:p-5",
            card.highlight
              ? "bg-[#c8e972]/20 dark:bg-[#c8e972]/10"
              : "bg-muted/30 dark:bg-muted/20",
          )}
        >
          <div className="flex items-start justify-between">
            <p className="text-xs sm:text-sm text-muted-foreground mb-2">
              {card.title}
            </p>
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl",
                card.highlight ? "bg-[#c8e972]/30" : "bg-muted/50",
              )}
            >
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-foreground tabular-nums mb-1">
            {card.value}
          </h3>

          <div className="flex items-center gap-1.5">
            {card.trend === "up" ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
            )}
            <span
              className={cn(
                "text-xs font-medium",
                card.trend === "up" ? "text-emerald-500" : "text-rose-500",
              )}
            >
              {card.change}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function OrderStatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-2xl p-4 sm:p-5 bg-muted/30">
          <div className="h-4 w-16 bg-muted/60 rounded animate-pulse mb-2" />
          <div className="h-7 w-20 bg-muted/60 rounded animate-pulse mb-2" />
          <div className="flex items-center gap-1.5">
            <div className="h-3.5 w-3.5 bg-muted/60 rounded animate-pulse" />
            <div className="h-3 w-10 bg-muted/60 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
