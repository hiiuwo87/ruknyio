"use client";

/**
 * 📋 Products Table
 * Paginated product list for admin dashboard
 */

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Tag,
  MoreHorizontal,
  Eye,
  Trash2,
  Star,
  StarOff,
  Store,
  Package,
  ShoppingCart,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ProductStatusBadge } from "./product-status-badge";

interface ProductItem {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  price: number;
  salePrice: number | null;
  quantity: number;
  status: string;
  currency: string;
  sku?: string;
  isFeatured: boolean;
  hasVariants: boolean;
  trackInventory: boolean;
  createdAt: string;
  image: string | null;
  store: {
    id: string;
    name: string;
    slug: string;
    logo?: string;
  } | null;
  category: {
    id: string;
    name: string;
    nameAr?: string;
  } | null;
  ordersCount: number;
  reviewsCount: number;
  variantsCount: number;
}

interface ProductsTableProps {
  products: ProductItem[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDelete: (id: string, name: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onToggleFeatured: (id: string, isFeatured: boolean) => void;
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

export function ProductsTable({
  products,
  total,
  page,
  totalPages,
  onPageChange,
  onDelete,
  onStatusChange,
  onToggleFeatured,
}: ProductsTableProps) {
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
          <h3 className="text-base font-bold text-foreground">All Products</h3>
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

      {/* Product List */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Tag className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">No products found</p>
          <p className="text-xs mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product, index) => (
            <ProductRow
              key={product.id}
              product={product}
              index={index}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              onToggleFeatured={onToggleFeatured}
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

// ─── Single Product Row ──────────────────────────────

function ProductRow({
  product,
  index,
  onDelete,
  onStatusChange,
  onToggleFeatured,
}: {
  product: ProductItem;
  index: number;
  onDelete: (id: string, name: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onToggleFeatured: (id: string, isFeatured: boolean) => void;
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

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card hover:bg-muted/50 transition-colors group"
    >
      {/* Product Image */}
      <div className="flex-shrink-0">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-10 w-10 rounded-xl object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-muted/60 shrink-0">
            <Tag className="h-4 w-4 text-primary" />
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/products/${product.id}`}
            className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate"
          >
            {product.name}
          </Link>
          {product.isFeatured && (
            <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
          )}
          <ProductStatusBadge status={product.status} />
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {product.sku && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {product.sku}
            </span>
          )}
          {product.store && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Store className="h-2.5 w-2.5" />
              {product.store.name}
            </span>
          )}
          {product.category && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Package className="h-2.5 w-2.5" />
              {product.category.name}
            </span>
          )}
          {product.ordersCount > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <ShoppingCart className="h-2.5 w-2.5" />
              {product.ordersCount} sold
            </span>
          )}
          <span className="text-xs text-muted-foreground shrink-0">
            {timeAgo(product.createdAt)}
          </span>
        </div>
      </div>

      {/* Price & Stock */}
      <div className="hidden sm:block text-right">
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {formatCurrency(product.price, product.currency)}
        </span>
        {product.salePrice && (
          <p className="text-[10px] text-emerald-500">
            Sale: {formatCurrency(product.salePrice, product.currency)}
          </p>
        )}
        {product.trackInventory && (
          <p
            className={cn(
              "text-[10px]",
              product.quantity <= 0
                ? "text-rose-500"
                : product.quantity < 10
                  ? "text-amber-500"
                  : "text-muted-foreground",
            )}
          >
            Stock: {product.quantity}
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
              href={`/dashboard/products/${product.id}`}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <Eye className="h-3.5 w-3.5" />
              View Details
            </Link>

            {/* Toggle Featured */}
            <button
              onClick={() => {
                onToggleFeatured(product.id, !product.isFeatured);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-amber-600 hover:bg-amber-500/10 transition-colors"
            >
              {product.isFeatured ? (
                <>
                  <StarOff className="h-3.5 w-3.5" />
                  Remove Featured
                </>
              ) : (
                <>
                  <Star className="h-3.5 w-3.5" />
                  Mark Featured
                </>
              )}
            </button>

            {/* Status Changes */}
            {product.status === "ACTIVE" && (
              <button
                onClick={() => {
                  onStatusChange(product.id, "INACTIVE");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-500/10 transition-colors"
              >
                <Tag className="h-3.5 w-3.5" />
                Deactivate
              </button>
            )}
            {product.status === "INACTIVE" && (
              <button
                onClick={() => {
                  onStatusChange(product.id, "ACTIVE");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-emerald-600 hover:bg-emerald-500/10 transition-colors"
              >
                <Tag className="h-3.5 w-3.5" />
                Activate
              </button>
            )}
            {product.status === "OUT_OF_STOCK" && (
              <button
                onClick={() => {
                  onStatusChange(product.id, "ACTIVE");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-emerald-600 hover:bg-emerald-500/10 transition-colors"
              >
                <Tag className="h-3.5 w-3.5" />
                Mark Active
              </button>
            )}

            <div className="my-1 border-t border-border/10" />

            <button
              onClick={() => {
                onDelete(product.id, product.name);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-600 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Product
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function ProductsTableSkeleton() {
  return (
    <div className="rounded-3xl bg-muted/30 p-5 sm:p-6 space-y-2">
      <div className="h-6 w-32 bg-muted/60 rounded animate-pulse mb-4" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card"
        >
          <div className="h-10 w-10 rounded-xl bg-muted/60 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 bg-muted/60 rounded animate-pulse" />
            <div className="h-3 w-28 bg-muted/60 rounded animate-pulse" />
          </div>
          <div className="h-4 w-20 bg-muted/60 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
