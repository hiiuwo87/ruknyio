'use client';

/**
 * 📦 Recent Orders Component
 * قائمة آخر الطلبات - تصميم موحد ونظيف
 */

import { motion } from "framer-motion";
import { Clock, CheckCircle2, XCircle, Truck, ShoppingBag, ArrowUpLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface OrderItem {
  productName: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string;
  total: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
}

interface RecentOrdersProps {
  orders: Order[];
  formatCurrency: (amount: number) => string;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  PENDING: { label: "معلق", icon: Clock, color: "text-amber-500" },
  PROCESSING: { label: "قيد المعالجة", icon: Loader2, color: "text-blue-500" },
  SHIPPED: { label: "تم الشحن", icon: Truck, color: "text-violet-500" },
  COMPLETED: { label: "مكتمل", icon: CheckCircle2, color: "text-emerald-500" },
  CANCELLED: { label: "ملغي", icon: XCircle, color: "text-rose-500" },
};

function getStatusConfig(status: string) {
  return statusConfig[status.toUpperCase()] || statusConfig.PENDING;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "الآن";
  if (diffMins < 60) return `منذ ${diffMins} د`;
  if (diffHours < 24) return `منذ ${diffHours} س`;
  return `منذ ${diffDays} ي`;
}

export function RecentOrders({ orders, formatCurrency }: RecentOrdersProps) {
  if (orders.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="rounded-3xl bg-muted/30 p-5 sm:p-6"
      >
        <h3 className="text-base font-bold text-foreground mb-4">آخر الطلبات</h3>
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <ShoppingBag className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">لا توجد طلبات حالياً</p>
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-foreground">آخر الطلبات</h3>
        <Link
          href="/app/store/orders"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          عرض الكل
          <ArrowUpLeft className="w-3 h-3" />
        </Link>
      </div>

      {/* Orders List */}
      <div className="space-y-2">
        {orders.map((order, index) => {
          const config = getStatusConfig(order.status);
          const StatusIcon = config.icon;

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl bg-card",
                index === 0 && "bg-primary/10 dark:bg-primary/5"
              )}
            >
              {/* Status Icon */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                index === 0 ? "bg-primary/20" : "bg-muted/60"
              )}>
                <StatusIcon className={cn(
                  "w-4 h-4",
                  index === 0 ? "text-foreground" : config.color
                )} />
              </div>

              {/* Order Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    #{order.orderNumber}
                  </span>
                  <span className={cn("text-xs", config.color)}>
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {order.customerName} • {order.items.length} منتج
                </p>
              </div>

              {/* Amount & Time */}
              <div className="text-left shrink-0">
                <p className="text-sm font-bold text-foreground tabular-nums">
                  {formatCurrency(order.total)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatTimeAgo(order.createdAt)}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

export function RecentOrdersSkeleton() {
  return (
    <div className="rounded-3xl bg-muted/30 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-24 bg-muted/60 rounded animate-pulse" />
        <div className="h-4 w-16 bg-muted/60 rounded animate-pulse" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card">
            <div className="w-8 h-8 rounded-full bg-muted/60 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-24 bg-muted/60 rounded animate-pulse" />
              <div className="h-3 w-32 bg-muted/60 rounded animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="h-4 w-16 bg-muted/60 rounded animate-pulse" />
              <div className="h-3 w-10 bg-muted/60 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
