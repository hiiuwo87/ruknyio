"use client";

/**
 * 🏷️ Verification Status Badge
 */

import { cn } from "@/lib/utils";
import { Clock, Eye, CheckCircle, XCircle } from "lucide-react";

const STATUS_CONFIG: Record<
  string,
  { label: string; labelAr: string; color: string; bg: string; icon: React.ElementType }
> = {
  PENDING: {
    label: "Pending",
    labelAr: "قيد الانتظار",
    color: "text-amber-600",
    bg: "bg-amber-500/10",
    icon: Clock,
  },
  UNDER_REVIEW: {
    label: "Under Review",
    labelAr: "قيد المراجعة",
    color: "text-blue-600",
    bg: "bg-blue-500/10",
    icon: Eye,
  },
  APPROVED: {
    label: "Approved",
    labelAr: "موافق عليه",
    color: "text-emerald-600",
    bg: "bg-emerald-500/10",
    icon: CheckCircle,
  },
  REJECTED: {
    label: "Rejected",
    labelAr: "مرفوض",
    color: "text-rose-600",
    bg: "bg-rose-500/10",
    icon: XCircle,
  },
};

export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status]?.label || status;
}

export function getStatusLabelAr(status: string): string {
  return STATUS_CONFIG[status]?.labelAr || status;
}

export function VerificationStatusBadge({
  status,
  size = "sm",
}: {
  status: string;
  size?: "sm" | "md";
}) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        config.bg,
        config.color,
        size === "sm"
          ? "text-[10px] px-1.5 py-0.5"
          : "text-xs px-2 py-0.5",
      )}
    >
      <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {config.label}
    </span>
  );
}
