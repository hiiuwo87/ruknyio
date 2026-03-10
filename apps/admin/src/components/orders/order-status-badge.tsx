"use client";

/**
 * 🏷️ Order Status Badge
 * Consistent status display across the admin panel
 */

import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; labelAr: string; bg: string; text: string; dot: string }
> = {
  PENDING: {
    label: "Pending",
    labelAr: "قيد الانتظار",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  CONFIRMED: {
    label: "Confirmed",
    labelAr: "تم التأكيد",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  PROCESSING: {
    label: "Processing",
    labelAr: "قيد التحضير",
    bg: "bg-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-400",
    dot: "bg-indigo-500",
  },
  SHIPPED: {
    label: "Shipped",
    labelAr: "تم الشحن",
    bg: "bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
    dot: "bg-purple-500",
  },
  OUT_FOR_DELIVERY: {
    label: "Out for Delivery",
    labelAr: "في الطريق",
    bg: "bg-cyan-500/10",
    text: "text-cyan-600 dark:text-cyan-400",
    dot: "bg-cyan-500",
  },
  DELIVERED: {
    label: "Delivered",
    labelAr: "تم التسليم",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  CANCELLED: {
    label: "Cancelled",
    labelAr: "ملغي",
    bg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  REFUNDED: {
    label: "Refunded",
    labelAr: "مسترد",
    bg: "bg-gray-500/10",
    text: "text-gray-600 dark:text-gray-400",
    dot: "bg-gray-500",
  },
};

interface OrderStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  showArabic?: boolean;
}

export function OrderStatusBadge({
  status,
  size = "sm",
  showArabic = false,
}: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;

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
