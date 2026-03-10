"use client";

/**
 * 🔍 Store Details Component
 * Full store information view with products, orders, and stats
 */

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Store,
  ArrowLeft,
  Package,
  ShoppingBag,
  Tag,
  MapPin,
  Mail,
  Phone,
  Calendar,
  User,
  Globe,
  FileText,
  ExternalLink,
  Ban,
  CheckCircle,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StoreDetailData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  descriptionAr?: string;
  logo?: string;
  banner?: string;
  contactEmail?: string;
  contactPhone?: string;
  status: "ACTIVE" | "INACTIVE";
  city?: string;
  country: string;
  address?: string;
  categoryId?: string;
  category?: string;
  employeesCount?: string;
  latitude?: number;
  longitude?: number;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    role: string;
    createdAt: string;
    profile?: {
      name: string;
      username: string;
      avatar?: string;
      bio?: string;
    };
  };
  store_categories?: {
    id: string;
    name: string;
    nameAr: string;
    slug: string;
    icon?: string;
    color: string;
  };
  _count: {
    products: number;
    orders: number;
    coupons: number;
    forms: number;
  };
  recentProducts: Array<{
    id: string;
    name: string;
    nameAr?: string;
    slug: string;
    price: number;
    salePrice?: number;
    quantity: number;
    status: string;
    currency: string;
    isFeatured: boolean;
    createdAt: string;
    product_images: Array<{ imagePath: string }>;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    currency: string;
    createdAt: string;
    phoneNumber: string;
  }>;
  orderStats: Array<{
    status: string;
    count: number;
  }>;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPrice(price: number, currency: string): string {
  return `${Number(price).toLocaleString()} ${currency}`;
}

const orderStatusColors: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-600",
  CONFIRMED: "bg-blue-500/10 text-blue-600",
  PROCESSING: "bg-violet-500/10 text-violet-600",
  SHIPPED: "bg-sky-500/10 text-sky-600",
  DELIVERED: "bg-emerald-500/10 text-emerald-600",
  CANCELLED: "bg-red-500/10 text-red-600",
  REFUNDED: "bg-gray-500/10 text-gray-600",
};

export function StoreDetails({
  store,
  onToggleStatus,
  onDelete,
}: {
  store: StoreDetailData;
  onToggleStatus: (status: "ACTIVE" | "INACTIVE") => void;
  onDelete: () => void;
}) {
  const owner = store.user;
  const ownerName = owner?.profile?.name || owner?.email || "—";
  const ownerAvatar = owner?.profile?.avatar;

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/stores"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Stores
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              onToggleStatus(store.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")
            }
            className={cn(
              "flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium transition-all border",
              store.status === "ACTIVE"
                ? "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20"
                : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20",
            )}
          >
            {store.status === "ACTIVE" ? (
              <>
                <Ban className="h-3.5 w-3.5" /> Deactivate
              </>
            ) : (
              <>
                <CheckCircle className="h-3.5 w-3.5" /> Activate
              </>
            )}
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </div>

      {/* Store Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-muted/20 border border-border/30 overflow-hidden"
      >
        {/* Banner */}
        {store.banner && (
          <div className="h-32 w-full overflow-hidden">
            <img src={store.banner} alt="Banner" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Avatar — from owner profile */}
            {ownerAvatar ? (
              <img
                src={ownerAvatar}
                alt={store.name}
                className="h-14 w-14 rounded-2xl object-cover border border-border/30 -mt-8 relative z-10 bg-card"
              />
            ) : (
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center -mt-8 relative z-10 bg-card border border-border/30">
                <Store className="h-6 w-6 text-emerald-600" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">{store.name}</h1>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase",
                    store.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-amber-500/10 text-amber-600",
                  )}
                >
                  {store.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">/{store.slug}</p>
              {store.description && (
                <p className="text-sm text-muted-foreground mt-2 max-w-xl">
                  {store.description}
                </p>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {[
              { label: "Products", value: store._count.products, icon: Package, color: "text-violet-500" },
              { label: "Orders", value: store._count.orders, icon: ShoppingBag, color: "text-blue-500" },
              { label: "Coupons", value: store._count.coupons, icon: Tag, color: "text-amber-500" },
              { label: "Forms", value: store._count.forms, icon: FileText, color: "text-emerald-500" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border/20"
              >
                <stat.icon className={cn("h-4 w-4", stat.color)} />
                <div>
                  <p className="text-lg font-bold tabular-nums">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Store Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-muted/20 border border-border/30 p-4"
        >
          <h3 className="text-sm font-semibold text-foreground mb-3">Store Information</h3>
          <div className="space-y-2.5">
            {store.store_categories && (
              <InfoRow
                icon={Tag}
                label="Category"
                value={`${store.store_categories.nameAr} (${store.store_categories.name})`}
              />
            )}
            {store.city && (
              <InfoRow icon={MapPin} label="Location" value={`${store.city}, ${store.country}`} />
            )}
            {store.address && <InfoRow icon={Globe} label="Address" value={store.address} />}
            {store.contactEmail && (
              <InfoRow icon={Mail} label="Email" value={store.contactEmail} />
            )}
            {store.contactPhone && (
              <InfoRow icon={Phone} label="Phone" value={store.contactPhone} />
            )}
            {store.employeesCount && (
              <InfoRow icon={User} label="Employees" value={store.employeesCount} />
            )}
            <InfoRow icon={Calendar} label="Created" value={formatDate(store.createdAt)} />
            <InfoRow icon={Calendar} label="Updated" value={formatDate(store.updatedAt)} />
          </div>
        </motion.div>

        {/* Owner Info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-muted/20 border border-border/30 p-4"
        >
          <h3 className="text-sm font-semibold text-foreground mb-3">Owner</h3>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/20">
            {ownerAvatar ? (
              <img src={ownerAvatar} alt={ownerName} className="h-10 w-10 rounded-xl object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {ownerName[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{ownerName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{owner.email}</p>
              {owner.profile?.username && (
                <p className="text-[10px] text-muted-foreground/70">@{owner.profile.username}</p>
              )}
            </div>
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-primary/10 text-primary uppercase">
              {owner.role}
            </span>
          </div>
          {owner.profile?.bio && (
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{owner.profile.bio}</p>
          )}

          {/* Order Status Breakdown */}
          {store.orderStats.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-medium text-foreground mb-2">Order Status Breakdown</h4>
              <div className="space-y-1.5">
                {store.orderStats.map((stat) => (
                  <div key={stat.status} className="flex items-center justify-between">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-medium",
                        orderStatusColors[stat.status] || "bg-muted text-muted-foreground",
                      )}
                    >
                      {stat.status}
                    </span>
                    <span className="text-xs font-medium tabular-nums">{stat.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent Products */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-muted/20 border border-border/30 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-foreground">Recent Products</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground font-medium">
              {store._count.products}
            </span>
          </div>
        </div>
        {store.recentProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Package className="h-6 w-6 mb-1.5 opacity-50" />
            <p className="text-xs">No products yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {store.recentProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors"
              >
                {product.product_images?.[0] ? (
                  <img
                    src={product.product_images[0].imagePath}
                    alt={product.name}
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">
                    <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatPrice(product.price, product.currency)}
                    {product.salePrice && (
                      <span className="ml-1 text-emerald-500">
                        → {formatPrice(product.salePrice, product.currency)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    Qty: {product.quantity}
                  </span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-medium",
                      product.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600",
                    )}
                  >
                    {product.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Recent Orders */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl bg-muted/20 border border-border/30 overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-foreground">Recent Orders</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground font-medium">
              {store._count.orders}
            </span>
          </div>
        </div>
        {store.recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <ShoppingBag className="h-6 w-6 mb-1.5 opacity-50" />
            <p className="text-xs">No orders yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {store.recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground">
                      #{order.orderNumber}
                    </p>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] font-medium",
                        orderStatusColors[order.status] || "bg-muted text-muted-foreground",
                      )}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {order.phoneNumber} · {formatDate(order.createdAt)}
                  </p>
                </div>
                <p className="text-xs font-semibold tabular-nums">
                  {formatPrice(order.total, order.currency)}
                </p>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Helper Component ────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Store;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-[11px] text-muted-foreground w-16 flex-shrink-0">{label}</span>
      <span className="text-xs text-foreground truncate">{value}</span>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────

export function StoreDetailsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-muted/60 animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded-xl bg-muted/60 animate-pulse" />
          <div className="h-8 w-20 rounded-xl bg-muted/60 animate-pulse" />
        </div>
      </div>
      <div className="rounded-2xl bg-muted/30 p-5">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-muted/60 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 rounded bg-muted/60 animate-pulse" />
            <div className="h-3 w-24 rounded bg-muted/60 animate-pulse" />
            <div className="h-4 w-64 rounded bg-muted/60 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted/60 animate-pulse" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 rounded-2xl bg-muted/30 animate-pulse" />
        <div className="h-48 rounded-2xl bg-muted/30 animate-pulse" />
      </div>
    </div>
  );
}
