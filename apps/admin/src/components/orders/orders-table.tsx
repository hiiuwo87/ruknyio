"use client";

/**
 * 📋 Orders Table
 * Paginated order list for admin dashboard
 */

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ShoppingBag,
  MoreHorizontal,
  Eye,
  Trash2,
  RefreshCw,
  Package,
  Store,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { OrderStatusBadge } from "./order-status-badge";

interface OrderItem {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  currency: string;
  phoneNumber?: string;
  createdAt: string;
  itemsCount: number;
  customer: {
    id: string;
    email: string;
    name?: string;
    avatar?: string;
  } | null;
  store: {
    id: string;
    name: string;
    slug: string;
    logo?: string;
  } | null;
}

interface OrdersTableProps {
  orders: OrderItem[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDelete: (id: string, orderNumber: string) => void;
  onStatusChange: (id: string, status: string) => void;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatCurrency(amount: number, currency = "IQD"): string {
  return `${amount.toLocaleString("en-US")} ${currency}`;
}

export function OrdersTable({
  orders,
  total,
  page,
  totalPages,
  onPageChange,
  onDelete,
  onStatusChange,
}: OrdersTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl bg-muted/30 p-5 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-foreground">All Orders</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-card border border-border/50 text-muted-foreground font-medium">
            {total}
          </span>
        </div>
        {totalPages > 1 && (
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
        )}
      </div>

      {/* Order List */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <ShoppingBag className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">No orders found</p>
          <p className="text-xs mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order, index) => (
            <OrderRow
              key={order.id}
              order={order}
              index={index}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/10">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const pageNum = page <= 3 ? i + 1 : page - 2 + i;
              if (pageNum > totalPages || pageNum < 1) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={cn(
                    "h-7 w-7 rounded-lg text-xs font-medium transition-colors",
                    pageNum === page
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-card text-muted-foreground",
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-card hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Single Order Row ────────────────────────────────

function OrderRow({
  order,
  index,
  onDelete,
  onStatusChange,
}: {
  order: OrderItem;
  index: number;
  onDelete: (id: string, orderNumber: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const customerName = order.customer?.name || order.customer?.email || "Guest";
  const customerAvatar = order.customer?.avatar;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card hover:bg-muted/50 transition-colors group"
    >
      {/* Customer Avatar */}
      <div className="flex-shrink-0">
        {customerAvatar ? (
          <img
            src={customerAvatar}
            alt={customerName}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted/60 shrink-0">
            <ShoppingBag className="h-4 w-4 text-primary" />
          </div>
        )}
      </div>

      {/* Order Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/orders/${order.id}`}
            className="text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            {order.orderNumber}
          </Link>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">
            {customerName}
          </span>
          {order.store && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Store className="h-2.5 w-2.5" />
              {order.store.name}
            </span>
          )}
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Package className="h-2.5 w-2.5" />
            {order.itemsCount} items
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {timeAgo(order.createdAt)}
          </span>
        </div>
      </div>

      {/* Amount */}
      <div className="hidden sm:block text-right">
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {formatCurrency(order.total, order.currency)}
        </span>
        {order.discount > 0 && (
          <p className="text-[10px] text-emerald-500">
            -{formatCurrency(order.discount, order.currency)}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm p-1.5 shadow-lg">
            <Link
              href={`/dashboard/orders/${order.id}`}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <Eye className="h-3.5 w-3.5" />
              View Details
            </Link>

            {/* Quick Status Changes */}
            {order.status === "PENDING" && (
              <button
                onClick={() => {
                  onStatusChange(order.id, "CONFIRMED");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-blue-600 hover:bg-blue-500/10 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Confirm Order
              </button>
            )}
            {order.status === "CONFIRMED" && (
              <button
                onClick={() => {
                  onStatusChange(order.id, "PROCESSING");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-indigo-600 hover:bg-indigo-500/10 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Start Processing
              </button>
            )}

            <div className="h-px bg-border/30 my-1" />
            <button
              onClick={() => {
                onDelete(order.id, order.orderNumber);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Order
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Skeleton ────────────────────────────────────────

export function OrdersTableSkeleton() {
  return (
    <div className="rounded-3xl bg-muted/30 p-5 sm:p-6">
      <div className="h-5 w-24 bg-muted/60 rounded animate-pulse mb-4" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card"
          >
            <div className="w-8 h-8 rounded-full bg-muted/60 animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-3/4 bg-muted/60 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-muted/60 rounded animate-pulse" />
            </div>
            <div className="hidden sm:block">
              <div className="h-4 w-20 bg-muted/60 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
