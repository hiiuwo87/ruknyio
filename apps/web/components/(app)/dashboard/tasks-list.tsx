"use client";

/**
 * 🔔 Notifications List Component
 * قائمة الإشعارات والنشاطات بتصميم بسيط ونظيف
 */

import { motion } from "framer-motion";
import { 
  Bell, 
  ShoppingBag, 
  Package, 
  FileText, 
  Calendar, 
  User, 
  Store,
  MessageSquare,
  Star,
  AlertCircle,
  CheckCircle2,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

type ActivityType = 
  | "order" | "product" | "form" | "event" | "user" | "store" 
  | "message" | "review" | "alert" | "success"
  | "form_created" | "form_updated" | "form_submission"
  | "event_created" | "event_updated" | "event_registration"
  | "product_created" | "product_updated"
  | "store_created" | "order_received"
  | "profile_created" | "profile_updated";

interface Activity {
  id: string;
  title: string;
  description?: string;
  type?: ActivityType;
  time?: string;
  isNew?: boolean;
}

interface TasksListProps {
  title?: string;
  tasks: Activity[];
  onTaskClick?: (task: Activity) => void;
}

const typeIcons: Record<string, { icon: LucideIcon; color: string }> = {
  order: { icon: ShoppingBag, color: "text-blue-500" },
  order_received: { icon: ShoppingBag, color: "text-blue-500" },
  product: { icon: Package, color: "text-violet-500" },
  product_created: { icon: Package, color: "text-violet-500" },
  product_updated: { icon: Package, color: "text-violet-500" },
  form: { icon: FileText, color: "text-cyan-500" },
  form_created: { icon: FileText, color: "text-cyan-500" },
  form_updated: { icon: FileText, color: "text-cyan-500" },
  form_submission: { icon: FileText, color: "text-cyan-500" },
  event: { icon: Calendar, color: "text-rose-500" },
  event_created: { icon: Calendar, color: "text-rose-500" },
  event_updated: { icon: Calendar, color: "text-rose-500" },
  event_registration: { icon: Calendar, color: "text-rose-500" },
  user: { icon: User, color: "text-emerald-500" },
  profile_created: { icon: User, color: "text-emerald-500" },
  profile_updated: { icon: User, color: "text-emerald-500" },
  store: { icon: Store, color: "text-amber-500" },
  store_created: { icon: Store, color: "text-amber-500" },
  message: { icon: MessageSquare, color: "text-indigo-500" },
  review: { icon: Star, color: "text-yellow-500" },
  alert: { icon: AlertCircle, color: "text-rose-500" },
  success: { icon: CheckCircle2, color: "text-emerald-500" },
};

function getIconConfig(type?: string) {
  return typeIcons[type || "alert"] || { icon: Bell, color: "text-muted-foreground" };
}

export function TasksList({ 
  title = "آخر النشاطات", 
  tasks,
  onTaskClick 
}: TasksListProps) {
  if (!tasks || tasks.length === 0) {
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
          <p className="text-sm">لا توجد نشاطات حالياً</p>
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
      {/* Header */}
      <h3 className="text-base font-bold text-foreground mb-4">{title}</h3>

      {/* Activities List */}
      <div className="space-y-2">
        {tasks.map((activity, index) => {
          const iconConfig = getIconConfig(activity.type);
          const IconComponent = iconConfig.icon;

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onTaskClick?.(activity)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors cursor-pointer",
                activity.isNew
                  ? "bg-primary/10 dark:bg-primary/5"
                  : "bg-card hover:bg-muted/50"
              )}
            >
              {/* Icon */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                activity.isNew ? "bg-primary/20" : "bg-muted/60"
              )}>
                <IconComponent className={cn(
                  "w-4 h-4",
                  activity.isNew ? "text-foreground" : iconConfig.color
                )} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {activity.title}
                </p>
                {activity.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {activity.description}
                  </p>
                )}
              </div>

              {/* Time */}
              {activity.time && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {activity.time}
                </span>
              )}

              {/* New Badge */}
              {activity.isNew && (
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function TasksListSkeleton() {
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
