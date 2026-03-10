"use client";

/**
 * 📋 Stores Table
 * Matches dashboard RecentActivity design pattern (rounded-3xl, bg-card rows)
 */

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Store,
  MoreHorizontal,
  Eye,
  Ban,
  CheckCircle,
  Trash2,
  Package,
  ShoppingBag,
  MapPin,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface StoreItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  status: "ACTIVE" | "INACTIVE";
  city?: string;
  country: string;
  contactEmail?: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    profile?: {
      name: string;
      username: string;
      avatar?: string;
    };
  };
  store_categories?: {
    id: string;
    name: string;
    nameAr: string;
    icon?: string;
    color: string;
  };
  _count: {
    products: number;
    orders: number;
    coupons: number;
  };
}

interface StoresTableProps {
  stores: StoreItem[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onToggleStatus: (id: string, status: "ACTIVE" | "INACTIVE") => void;
  onDelete: (id: string, name: string) => void;
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

export function StoresTable({
  stores,
  total,
  page,
  totalPages,
  onPageChange,
  onToggleStatus,
  onDelete,
}: StoresTableProps) {
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
          <h3 className="text-base font-bold text-foreground">All Stores</h3>
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

      {/* Store List */}
      {stores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Store className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">No stores found</p>
          <p className="text-xs mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {stores.map((store, index) => (
            <StoreRow
              key={store.id}
              store={store}
              index={index}
              onToggleStatus={onToggleStatus}
              onDelete={onDelete}
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

// ─── Single Store Row ────────────────────────────────

function StoreRow({
  store,
  index,
  onToggleStatus,
  onDelete,
}: {
  store: StoreItem;
  index: number;
  onToggleStatus: (id: string, status: "ACTIVE" | "INACTIVE") => void;
  onDelete: (id: string, name: string) => void;
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

  const ownerName = store.user?.profile?.name || store.user?.email || "—";
  const ownerAvatar = store.user?.profile?.avatar;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card hover:bg-muted/50 transition-colors group"
    >
      {/* Avatar / Logo */}
      <div className="flex-shrink-0">
        {ownerAvatar ? (
          <img
            src={ownerAvatar}
            alt={store.name}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted/60 shrink-0">
            <Store className="h-4 w-4 text-emerald-500" />
          </div>
        )}
      </div>

      {/* Store Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/stores/${store.id}`}
            className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate"
          >
            {store.name}
          </Link>
          {/* Status Dot */}
          <div className={cn(
            "w-2 h-2 rounded-full shrink-0",
            store.status === "ACTIVE" ? "bg-emerald-500" : "bg-amber-500",
          )} />
          {/* Category Badge */}
          {store.store_categories && (
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] font-medium"
              style={{
                backgroundColor: `${store.store_categories.color}15`,
                color: store.store_categories.color,
              }}
            >
              {store.store_categories.nameAr}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground truncate">
            {ownerName}
          </span>
          {store.city && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <MapPin className="h-2.5 w-2.5" />
              {store.city}
            </span>
          )}
          <span className="text-xs text-muted-foreground shrink-0">
            {timeAgo(store.createdAt)}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="hidden md:flex items-center gap-4">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Package className="h-3 w-3" />
          <span className="tabular-nums">{store._count.products}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <ShoppingBag className="h-3 w-3" />
          <span className="tabular-nums">{store._count.orders}</span>
        </div>
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
          <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm p-1.5 shadow-lg">
            <Link
              href={`/dashboard/stores/${store.id}`}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              <Eye className="h-3.5 w-3.5" />
              View Details
            </Link>
            <button
              onClick={() => {
                onToggleStatus(
                  store.id,
                  store.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                );
                setMenuOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                store.status === "ACTIVE"
                  ? "text-amber-600 hover:bg-amber-500/10"
                  : "text-emerald-600 hover:bg-emerald-500/10",
              )}
            >
              {store.status === "ACTIVE" ? (
                <>
                  <Ban className="h-3.5 w-3.5" />
                  Deactivate
                </>
              ) : (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Activate
                </>
              )}
            </button>
            <div className="h-px bg-border/30 my-1" />
            <button
              onClick={() => {
                onDelete(store.id, store.name);
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Store
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Skeleton ────────────────────────────────────────

export function StoresTableSkeleton() {
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
            <div className="hidden md:flex gap-4">
              <div className="h-3 w-8 bg-muted/60 rounded animate-pulse" />
              <div className="h-3 w-8 bg-muted/60 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
