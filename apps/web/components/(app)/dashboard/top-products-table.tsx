"use client";

/**
 * 📦 Top Products Component
 * المنتجات الأكثر مبيعاً - تصميم موحد ونظيف
 */

import { motion } from "framer-motion";
import { Package, TrendingUp, ArrowUpLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface TopProduct {
  id: string;
  name: string;
  price: number;
  quantity: number;
  amount: number;
}

interface TopProductsTableProps {
  products?: TopProduct[];
  formatCurrency?: (amount: number) => string;
}

const defaultProducts: TopProduct[] = [];

function defaultFormatCurrency(amount: number): string {
  return `${(amount ?? 0).toLocaleString("en-US")} IQD`;
}

export function TopProductsTable({
  products = defaultProducts,
  formatCurrency = defaultFormatCurrency,
}: TopProductsTableProps) {
  if (!products || products.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="rounded-3xl bg-muted/30 p-5 sm:p-6"
      >
        <h3 className="text-base font-bold text-foreground mb-4">المنتجات الأكثر مبيعاً</h3>
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Package className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">لا توجد منتجات حالياً</p>
        </div>
      </motion.div>
    );
  }

  const totalAmount = products.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl bg-muted/30 p-5 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">المنتجات الأكثر مبيعاً</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            إجمالي: {formatCurrency(totalAmount)}
          </p>
        </div>
        <Link
          href="/app/store/products"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          عرض الكل
          <ArrowUpLeft className="w-3 h-3" />
        </Link>
      </div>

      {/* Products List */}
      <div className="space-y-2">
        {products.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-2xl bg-card",
              index === 0 && "bg-primary/10 dark:bg-primary/5"
            )}
          >
            {/* Rank */}
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
              index === 0 
                ? "bg-primary/20 text-foreground" 
                : index === 1 
                  ? "bg-muted/80 text-foreground"
                  : index === 2
                    ? "bg-amber-500/20 text-amber-600"
                    : "bg-muted/60 text-muted-foreground"
            )}>
              {index + 1}
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {product.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(product.price || 0)} × {product.quantity || 0}
              </p>
            </div>

            {/* Amount */}
            <div className="text-left shrink-0">
              <p className="text-sm font-bold text-foreground tabular-nums">
                {formatCurrency(product.amount || 0)}
              </p>
              <div className="flex items-center justify-end gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] text-emerald-500">
                  {product.quantity || 0} مبيعة
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export function TopProductsTableSkeleton() {
  return (
    <div className="rounded-3xl bg-muted/30 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <div className="h-5 w-36 bg-muted/60 rounded animate-pulse" />
          <div className="h-3 w-24 bg-muted/60 rounded animate-pulse" />
        </div>
        <div className="h-4 w-16 bg-muted/60 rounded animate-pulse" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card">
            <div className="w-8 h-8 rounded-full bg-muted/60 animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-3/4 bg-muted/60 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-muted/60 rounded animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="h-4 w-20 bg-muted/60 rounded animate-pulse" />
              <div className="h-3 w-14 bg-muted/60 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
