"use client";

/**
 * 📦 Order Details Component
 * Full order detail view for admin
 */

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Store,
  MapPin,
  Phone,
  Mail,
  Package,
  Calendar,
  MessageSquare,
  Truck,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OrderStatusBadge } from "./order-status-badge";

interface OrderDetailData {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  currency: string;
  phoneNumber?: string;
  customerNote?: string;
  storeNote?: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    email: string;
    name?: string;
    username?: string;
    avatar?: string;
  } | null;
  store: {
    id: string;
    name: string;
    slug: string;
    logo?: string;
    contactEmail?: string;
    contactPhone?: string;
  } | null;
  address: {
    id: string;
    fullName: string;
    phoneNumber: string;
    city: string;
    district?: string;
    street?: string;
    building?: string;
    floor?: string;
    apartment?: string;
    notes?: string;
  } | null;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    productNameAr?: string;
    price: number;
    quantity: number;
    subtotal: number;
    image?: string;
  }>;
  coupon?: {
    code: string;
    discountType: string;
    discountValue: number;
  } | null;
}

interface OrderDetailsProps {
  order: OrderDetailData;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
}

function formatCurrency(amount: number, currency = "IQD"): string {
  return `${amount.toLocaleString("en-US")} ${currency}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_FLOW = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function OrderDetails({
  order,
  onStatusChange,
  onDelete,
}: OrderDetailsProps) {
  const nextStatuses = VALID_TRANSITIONS[order.status] || [];
  const currentStepIndex = STATUS_FLOW.indexOf(order.status);

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/orders"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">
                {order.orderNumber}
              </h1>
              <OrderStatusBadge status={order.status} size="md" />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(order.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Actions */}
          {nextStatuses.map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={cn(
                "h-8 px-3 rounded-xl text-xs font-medium transition-all",
                s === "CANCELLED" || s === "REFUNDED"
                  ? "bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
                  : "bg-primary/10 text-primary hover:bg-primary/20",
              )}
            >
              {s === "CANCELLED"
                ? "Cancel"
                : s === "REFUNDED"
                  ? "Refund"
                  : `Mark as ${s.replace(/_/g, " ").toLowerCase()}`}
            </button>
          ))}
          <button
            onClick={onDelete}
            className="h-8 px-3 rounded-xl text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>

      {/* Progress Timeline */}
      {order.status !== "CANCELLED" && order.status !== "REFUNDED" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Order Progress
          </h3>
          <div className="flex items-center gap-1">
            {STATUS_FLOW.map((step, i) => {
              const isActive = i <= currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step} className="flex-1 flex items-center gap-1">
                  <div
                    className={cn(
                      "flex-1 h-2 rounded-full transition-colors",
                      isActive
                        ? "bg-primary"
                        : "bg-muted/60",
                      isCurrent && "animate-pulse",
                    )}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            {STATUS_FLOW.map((step, i) => (
              <span
                key={step}
                className={cn(
                  "text-[9px] font-medium",
                  i <= currentStepIndex
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >
                {step.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Cancellation / Refund Notice */}
      {(order.status === "CANCELLED" || order.status === "REFUNDED") && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={cn(
            "rounded-2xl p-5",
            order.status === "CANCELLED" ? "bg-rose-500/10" : "bg-gray-500/10",
          )}
        >
          <h3
            className={cn(
              "text-sm font-semibold mb-1",
              order.status === "CANCELLED" ? "text-rose-600" : "text-gray-600",
            )}
          >
            {order.status === "CANCELLED"
              ? "Order Cancelled"
              : "Order Refunded"}
          </h3>
          {order.cancellationReason && (
            <p className="text-xs text-muted-foreground">
              Reason: {order.cancellationReason}
            </p>
          )}
          {order.cancelledAt && (
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(order.cancelledAt)}
            </p>
          )}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column - Items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Order Items */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-muted/30 p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Items ({order.items.length})
              </h3>
            </div>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card"
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.productName}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-muted/60 flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.productName}
                    </p>
                    {item.productNameAr && (
                      <p className="text-xs text-muted-foreground truncate" dir="rtl">
                        {item.productNameAr}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.price, order.currency)} x{" "}
                      {item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(item.subtotal, order.currency)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-4 pt-4 border-t border-border/20 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">
                  {formatCurrency(order.subtotal, order.currency)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Shipping</span>
                <span className="tabular-nums">
                  {formatCurrency(order.shippingFee, order.currency)}
                </span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-xs text-emerald-500">
                  <span>Discount</span>
                  <span className="tabular-nums">
                    -{formatCurrency(order.discount, order.currency)}
                  </span>
                </div>
              )}
              {order.coupon && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    Coupon:{" "}
                    <span className="font-mono text-primary">
                      {order.coupon.code}
                    </span>
                  </span>
                  <span>
                    {order.coupon.discountType === "PERCENTAGE"
                      ? `${order.coupon.discountValue}%`
                      : formatCurrency(
                          Number(order.coupon.discountValue),
                          order.currency,
                        )}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-foreground pt-2 border-t border-border/20">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatCurrency(order.total, order.currency)}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Notes */}
          {(order.customerNote || order.storeNote) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl bg-muted/30 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Notes</h3>
              </div>
              {order.customerNote && (
                <div className="p-3 rounded-xl bg-card mb-2">
                  <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase">
                    Customer Note
                  </p>
                  <p className="text-xs text-foreground">{order.customerNote}</p>
                </div>
              )}
              {order.storeNote && (
                <div className="p-3 rounded-xl bg-card">
                  <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase">
                    Store Note
                  </p>
                  <p className="text-xs text-foreground">{order.storeNote}</p>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Right Column - Info */}
        <div className="space-y-4">
          {/* Customer Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-muted/30 p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Customer
              </h3>
            </div>
            {order.customer ? (
              <div className="flex items-center gap-3">
                {order.customer.avatar ? (
                  <img
                    src={order.customer.avatar}
                    alt={order.customer.name || ""}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {order.customer.name || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {order.customer.email}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Guest checkout</p>
            )}
          </motion.div>

          {/* Store Info */}
          {order.store && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-2xl bg-muted/30 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <Store className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Store</h3>
              </div>
              <div className="flex items-center gap-3">
                {order.store.logo ? (
                  <img
                    src={order.store.logo}
                    alt={order.store.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center">
                    <Store className="h-5 w-5 text-emerald-500" />
                  </div>
                )}
                <div>
                  <Link
                    href={`/dashboard/stores/${order.store.id}`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {order.store.name}
                  </Link>
                  {order.store.contactEmail && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {order.store.contactEmail}
                    </p>
                  )}
                  {order.store.contactPhone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {order.store.contactPhone}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Delivery Address */}
          {order.address && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl bg-muted/30 p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  Delivery Address
                </h3>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p className="text-sm font-medium text-foreground">
                  {order.address.fullName}
                </p>
                <p className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {order.address.phoneNumber}
                </p>
                <p>
                  {[
                    order.address.street,
                    order.address.building,
                    order.address.floor && `Floor ${order.address.floor}`,
                    order.address.apartment && `Apt ${order.address.apartment}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p>
                  {[order.address.district, order.address.city]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {order.address.notes && (
                  <p className="italic text-[11px] mt-1">
                    Note: {order.address.notes}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Delivery Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-2xl bg-muted/30 p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Delivery Info
              </h3>
            </div>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Created</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Last Updated</span>
                <span>{formatDate(order.updatedAt)}</span>
              </div>
              {order.estimatedDelivery && (
                <div className="flex justify-between">
                  <span>Est. Delivery</span>
                  <span>{formatDate(order.estimatedDelivery)}</span>
                </div>
              )}
              {order.deliveredAt && (
                <div className="flex justify-between text-emerald-500">
                  <span>Delivered</span>
                  <span>{formatDate(order.deliveredAt)}</span>
                </div>
              )}
              {order.phoneNumber && (
                <div className="flex justify-between">
                  <span>Phone</span>
                  <span dir="ltr">{order.phoneNumber}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export function OrderDetailsSkeleton() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-muted/60 animate-pulse" />
        <div>
          <div className="h-5 w-40 bg-muted/60 rounded animate-pulse mb-1" />
          <div className="h-3 w-24 bg-muted/60 rounded animate-pulse" />
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-2xl bg-muted/30 p-5">
        <div className="h-4 w-32 bg-muted/60 rounded animate-pulse mb-4" />
        <div className="flex gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-2 rounded-full bg-muted/60 animate-pulse"
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-muted/30 p-5">
            <div className="h-4 w-20 bg-muted/60 rounded animate-pulse mb-4" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl bg-card mb-2"
              >
                <div className="h-12 w-12 rounded-lg bg-muted/60 animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-2/3 bg-muted/60 rounded animate-pulse" />
                  <div className="h-3 w-1/3 bg-muted/60 rounded animate-pulse" />
                </div>
                <div className="h-4 w-16 bg-muted/60 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-muted/30 p-5">
              <div className="h-4 w-20 bg-muted/60 rounded animate-pulse mb-3" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-muted/60 rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-muted/60 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
