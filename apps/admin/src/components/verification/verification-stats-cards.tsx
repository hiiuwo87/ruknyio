"use client";

/**
 * 📊 Verification Stats Cards
 */

import { motion } from "framer-motion";
import {
  FileCheck,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface VerificationStatsData {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  byStatus: {
    pending: number;
    underReview: number;
    approved: number;
    rejected: number;
  };
  approvalRate: number;
}

const cards = [
  {
    key: "total",
    label: "Total Requests",
    icon: FileCheck,
    color: "text-primary",
    getValue: (s: VerificationStatsData) => s.total,
    getSub: (s: VerificationStatsData) => `${s.thisMonth} this month`,
  },
  {
    key: "pending",
    label: "Pending",
    icon: Clock,
    color: "text-amber-500",
    getValue: (s: VerificationStatsData) => s.byStatus.pending + s.byStatus.underReview,
    getSub: (s: VerificationStatsData) => `${s.today} today`,
  },
  {
    key: "approved",
    label: "Approved",
    icon: CheckCircle,
    color: "text-emerald-500",
    getValue: (s: VerificationStatsData) => s.byStatus.approved,
    getSub: (s: VerificationStatsData) => `${s.approvalRate}% rate`,
  },
  {
    key: "rejected",
    label: "Rejected",
    icon: XCircle,
    color: "text-rose-500",
    getValue: (s: VerificationStatsData) => s.byStatus.rejected,
    getSub: () => "",
  },
  {
    key: "weekly",
    label: "This Week",
    icon: TrendingUp,
    color: "text-blue-500",
    getValue: (s: VerificationStatsData) => s.thisWeek,
    getSub: (s: VerificationStatsData) => `${s.today} today`,
  },
];

export function VerificationStatsCards({ stats }: { stats: VerificationStatsData }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 sm:grid-cols-5 gap-3"
    >
      {cards.map((card, i) => {
        const Icon = card.icon;
        const value = card.getValue(stats);
        const sub = card.getSub(stats);
        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl bg-muted/30 p-3 sm:p-4 flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 shrink-0">
              <Icon className={cn("h-4 w-4", card.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground leading-none">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{card.label}</p>
              {sub && (
                <p className="text-[9px] text-muted-foreground/70">{sub}</p>
              )}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

export function VerificationStatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-muted/30 p-3 sm:p-4 flex items-center gap-3 animate-pulse"
        >
          <div className="h-9 w-9 rounded-xl bg-muted/60" />
          <div className="space-y-1.5 flex-1">
            <div className="h-5 w-10 bg-muted/60 rounded" />
            <div className="h-3 w-16 bg-muted/60 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
