"use client";

import { motion } from "framer-motion";
import {
  Bell,
  UserPlus,
  Store,
  FileText,
  Calendar,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  time?: string;
  isNew?: boolean;
}

interface RecentActivityProps {
  title?: string;
  items: ActivityItem[];
  onItemClick?: (item: ActivityItem) => void;
}

const typeIcons: Record<string, { icon: LucideIcon; color: string }> = {
  user_signup: { icon: UserPlus, color: "text-blue-500" },
  store_created: { icon: Store, color: "text-emerald-500" },
  form_created: { icon: FileText, color: "text-violet-500" },
  event_created: { icon: Calendar, color: "text-rose-500" },
  order: { icon: ShoppingBag, color: "text-amber-500" },
};

function getIconConfig(type?: string) {
  return typeIcons[type || "user_signup"] || { icon: Bell, color: "text-muted-foreground" };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RecentActivity({
  title = "Recent Activity",
  items,
  onItemClick,
}: RecentActivityProps) {
  if (!items || items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="rounded-3xl bg-muted/30 p-5 sm:p-6"
      >
        <h3 className="text-base font-bold text-foreground mb-4">{title}</h3>
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Bell className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">No recent activity</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl bg-muted/30 p-5 sm:p-6"
    >
      <h3 className="text-base font-bold text-foreground mb-4">{title}</h3>

      <div className="space-y-2">
        {items.map((item, index) => {
          const iconConfig = getIconConfig(item.type);
          const IconComponent = iconConfig.icon;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onItemClick?.(item)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors cursor-pointer",
                item.isNew
                  ? "bg-[#c8e972]/20 dark:bg-[#c8e972]/10"
                  : "bg-card hover:bg-muted/50"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  item.isNew ? "bg-[#c8e972]" : "bg-muted/60"
                )}
              >
                <IconComponent
                  className={cn(
                    "w-4 h-4",
                    item.isNew ? "text-foreground" : iconConfig.color
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </p>
                )}
              </div>

              {item.time && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {item.time}
                </span>
              )}

              {item.isNew && (
                <span className="w-2 h-2 rounded-full bg-[#c8e972] shrink-0" />
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function RecentActivitySkeleton() {
  return (
    <div className="rounded-3xl bg-muted/30 p-5 sm:p-6">
      <div className="h-5 w-24 bg-muted/60 rounded animate-pulse mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card"
          >
            <div className="w-8 h-8 rounded-full bg-muted/60 animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-3/4 bg-muted/60 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-muted/60 rounded animate-pulse" />
            </div>
            <div className="h-3 w-12 bg-muted/60 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

export { timeAgo };
