"use client";

/**
 * 🏷️ Product Status Badge
 * Consistent status display for products across the admin panel
 */

import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; labelAr: string; bg: string; text: string; dot: string }
> = {
  ACTIVE: {
    label: "Active",
    labelAr: "نشط",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  INACTIVE: {
    label: "Inactive",
    labelAr: "غير نشط",
    bg: "bg-gray-500/10",
    text: "text-gray-600 dark:text-gray-400",
    dot: "bg-gray-500",
  },
  OUT_OF_STOCK: {
    label: "Out of Stock",
    labelAr: "نفذ المخزون",
    bg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
};

interface ProductStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  showArabic?: boolean;
}

export function ProductStatusBadge({
  status,
  size = "sm",
  showArabic = false,
}: ProductStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.ACTIVE;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        config.bg,
        config.text,
        size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {showArabic ? config.labelAr : config.label}
    </span>
  );
}

export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status]?.label || status;
}

export function getStatusLabelAr(status: string): string {
  return STATUS_CONFIG[status]?.labelAr || status;
}
