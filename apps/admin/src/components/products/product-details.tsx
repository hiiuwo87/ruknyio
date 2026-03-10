"use client";

/**
 * 📦 Product Details Component
 * Full product detail view for admin
 */

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Store,
  Tag,
  Star,
  StarOff,
  Package,
  DollarSign,
  BarChart3,
  Heart,
  MessageSquare,
  ShoppingCart,
  Trash2,
  Image as ImageIcon,
  Layers,
  Settings,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductStatusBadge } from "./product-status-badge";

interface ProductDetailData {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  description?: string;
  descriptionAr?: string;
  price: number;
  salePrice: number | null;
  quantity: number;
  status: string;
  currency: string;
  sku?: string;
  isFeatured: boolean;
  hasVariants: boolean;
  trackInventory: boolean;
  attributes: any;
  createdAt: string;
  updatedAt: string;
  store: {
    id: string;
    name: string;
    slug: string;
    logo?: string;
    contactEmail?: string;
    contactPhone?: string;
  } | null;
  category: {
    id: string;
    name: string;
    nameAr?: string;
  } | null;
  images: Array<{
    id: string;
    imagePath: string;
    displayOrder: number;
    isPrimary: boolean;
  }>;
  variants: Array<{
    id: string;
    sku?: string;
    price: number;
    compareAtPrice: number | null;
    stock: number;
    attributes: any;
    imageUrl?: string;
    isActive: boolean;
    createdAt: string;
  }>;
  productAttributes: Array<{
    id: string;
    key: string;
    value: string;
    valueAr?: string;
  }>;
  ordersCount: number;
  reviewsCount: number;
  wishlistsCount: number;
}

interface ProductDetailsProps {
  product: ProductDetailData;
  onStatusChange: (status: string) => void;
  onToggleFeatured: (isFeatured: boolean) => void;
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

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ["INACTIVE", "OUT_OF_STOCK"],
  INACTIVE: ["ACTIVE"],
  OUT_OF_STOCK: ["ACTIVE", "INACTIVE"],
};

export function ProductDetails({
  product,
  onStatusChange,
  onToggleFeatured,
  onDelete,
}: ProductDetailsProps) {
  const nextStatuses = VALID_STATUS_TRANSITIONS[product.status] || [];

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
            href="/dashboard/products"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">
                {product.name}
              </h1>
              {product.isFeatured && (
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              )}
              <ProductStatusBadge status={product.status} size="md" />
            </div>
            {product.nameAr && (
              <p className="text-sm text-muted-foreground mt-0.5" dir="rtl">
                {product.nameAr}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Featured */}
          <button
            onClick={() => onToggleFeatured(!product.isFeatured)}
            className={cn(
              "flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium transition-all",
              product.isFeatured
                ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600"
                : "bg-muted/40 hover:bg-amber-500/10 text-muted-foreground hover:text-amber-600",
            )}
          >
            {product.isFeatured ? (
              <>
                <StarOff className="h-3.5 w-3.5" />
                Unfeature
              </>
            ) : (
              <>
                <Star className="h-3.5 w-3.5" />
                Feature
              </>
            )}
          </button>

          {/* Status Transitions */}
          {nextStatuses.map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={cn(
                "flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium transition-all",
                s === "ACTIVE"
                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600"
                  : s === "INACTIVE"
                    ? "bg-gray-500/10 hover:bg-gray-500/20 text-gray-600"
                    : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-600",
              )}
            >
              {s === "ACTIVE" ? "Activate" : s === "INACTIVE" ? "Deactivate" : "Out of Stock"}
            </button>
          ))}

          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        {[
          {
            icon: ShoppingCart,
            label: "Orders",
            value: product.ordersCount.toString(),
            color: "text-blue-500",
          },
          {
            icon: MessageSquare,
            label: "Reviews",
            value: product.reviewsCount.toString(),
            color: "text-amber-500",
          },
          {
            icon: Heart,
            label: "Wishlists",
            value: product.wishlistsCount.toString(),
            color: "text-rose-500",
          },
          {
            icon: Layers,
            label: "Variants",
            value: product.variants.length.toString(),
            color: "text-purple-500",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl bg-muted/30 p-4 flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50">
              <stat.icon className={cn("h-4 w-4", stat.color)} />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Product Images */}
      {product.images.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Images ({product.images.length})
            </h3>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {product.images.map((img) => (
              <div
                key={img.id}
                className={cn(
                  "relative aspect-square rounded-xl overflow-hidden border-2",
                  img.isPrimary
                    ? "border-primary"
                    : "border-transparent",
                )}
              >
                <img
                  src={img.imagePath}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {img.isPrimary && (
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground text-[9px] font-medium">
                    Primary
                  </span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Pricing & Inventory */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl bg-muted/30 p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            Pricing & Inventory
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Price</p>
            <p className="text-sm font-semibold text-foreground">
              {formatCurrency(product.price, product.currency)}
            </p>
          </div>
          {product.salePrice && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Sale Price</p>
              <p className="text-sm font-semibold text-emerald-600">
                {formatCurrency(product.salePrice, product.currency)}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-1">Stock</p>
            <p
              className={cn(
                "text-sm font-semibold",
                product.quantity <= 0
                  ? "text-rose-600"
                  : product.quantity < 10
                    ? "text-amber-600"
                    : "text-foreground",
              )}
            >
              {product.quantity} units
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">SKU</p>
            <p className="text-sm font-mono text-foreground">
              {product.sku || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Currency</p>
            <p className="text-sm font-semibold text-foreground">
              {product.currency}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Track Inventory</p>
            <p className="text-sm font-semibold text-foreground">
              {product.trackInventory ? "Yes" : "No"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Has Variants</p>
            <p className="text-sm font-semibold text-foreground">
              {product.hasVariants ? "Yes" : "No"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Slug</p>
            <p className="text-sm font-mono text-muted-foreground truncate">
              {product.slug}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Description */}
      {(product.description || product.descriptionAr) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Description
            </h3>
          </div>
          {product.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {product.description}
            </p>
          )}
          {product.descriptionAr && (
            <p
              className="text-sm text-muted-foreground leading-relaxed"
              dir="rtl"
            >
              {product.descriptionAr}
            </p>
          )}
        </motion.div>
      )}

      {/* Product Attributes */}
      {product.productAttributes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Attributes ({product.productAttributes.length})
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {product.productAttributes.map((attr) => (
              <div
                key={attr.id}
                className="rounded-xl bg-card p-3 border border-border/30"
              >
                <p className="text-xs text-muted-foreground mb-0.5">
                  {attr.key}
                </p>
                <p className="text-sm font-medium text-foreground">
                  {attr.value}
                </p>
                {attr.valueAr && (
                  <p className="text-xs text-muted-foreground mt-0.5" dir="rtl">
                    {attr.valueAr}
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Variants */}
      {product.variants.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Variants ({product.variants.length})
            </h3>
          </div>
          <div className="space-y-2">
            {product.variants.map((variant) => (
              <div
                key={variant.id}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-xl border",
                  variant.isActive
                    ? "bg-card border-border/30"
                    : "bg-muted/20 border-border/20 opacity-60",
                )}
              >
                {variant.imageUrl && (
                  <img
                    src={variant.imageUrl}
                    alt="Variant"
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {variant.sku && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {variant.sku}
                      </span>
                    )}
                    {!variant.isActive && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-500 font-medium">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {typeof variant.attributes === "object" &&
                      variant.attributes &&
                      Object.entries(variant.attributes as Record<string, string>).map(
                        ([key, val]) => (
                          <span
                            key={key}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground"
                          >
                            {key}: {val}
                          </span>
                        ),
                      )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(variant.price, product.currency)}
                  </p>
                  {variant.compareAtPrice && (
                    <p className="text-[10px] text-muted-foreground line-through">
                      {formatCurrency(variant.compareAtPrice, product.currency)}
                    </p>
                  )}
                  <p
                    className={cn(
                      "text-[10px]",
                      variant.stock <= 0
                        ? "text-rose-500"
                        : variant.stock < 10
                          ? "text-amber-500"
                          : "text-muted-foreground",
                    )}
                  >
                    Stock: {variant.stock}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Store & Category Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Store */}
        {product.store && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-2xl bg-muted/30 p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <Store className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Store</h3>
            </div>
            <div className="flex items-center gap-3">
              {product.store.logo ? (
                <img
                  src={product.store.logo}
                  alt={product.store.name}
                  className="h-10 w-10 rounded-xl object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center">
                  <Store className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {product.store.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  /{product.store.slug}
                </p>
                {product.store.contactEmail && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {product.store.contactEmail}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Category & Dates */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl bg-muted/30 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Details</h3>
          </div>
          <div className="space-y-3">
            {product.category && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Category</p>
                <p className="text-sm font-medium text-foreground">
                  {product.category.name}
                  {product.category.nameAr && (
                    <span className="text-muted-foreground ml-2" dir="rtl">
                      ({product.category.nameAr})
                    </span>
                  )}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Created</p>
              <p className="text-sm text-foreground">
                {formatDate(product.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                Last Updated
              </p>
              <p className="text-sm text-foreground">
                {formatDate(product.updatedAt)}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function ProductDetailsSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-muted/60" />
        <div className="space-y-2">
          <div className="h-5 w-40 bg-muted/60 rounded" />
          <div className="h-3 w-24 bg-muted/60 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-muted/30 p-4 h-20" />
        ))}
      </div>
      <div className="rounded-2xl bg-muted/30 p-5 h-48" />
      <div className="rounded-2xl bg-muted/30 p-5 h-32" />
    </div>
  );
}
