"use client";

/**
 * 🏷️ User Role Badge
 * Consistent role display across the admin panel
 */

import { cn } from "@/lib/utils";

const ROLE_CONFIG: Record<
  string,
  { label: string; labelAr: string; bg: string; text: string; dot: string }
> = {
  ADMIN: {
    label: "Admin",
    labelAr: "مدير",
    bg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  PREMIUM: {
    label: "Premium",
    labelAr: "مميز",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  BASIC: {
    label: "Basic",
    labelAr: "أساسي",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  GUEST: {
    label: "Guest",
    labelAr: "زائر",
    bg: "bg-gray-500/10",
    text: "text-gray-600 dark:text-gray-400",
    dot: "bg-gray-500",
  },
};

interface UserRoleBadgeProps {
  role: string;
  size?: "sm" | "md";
  showArabic?: boolean;
}

export function UserRoleBadge({
  role,
  size = "sm",
  showArabic = false,
}: UserRoleBadgeProps) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.BASIC;

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

export function getRoleLabel(role: string): string {
  return ROLE_CONFIG[role]?.label || role;
}

export function getRoleLabelAr(role: string): string {
  return ROLE_CONFIG[role]?.labelAr || role;
}
