"use client";

/**
 * 📦 Admin Products Dashboard
 * Main products management page with stats, filters, and table
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/client";
import { Tag, RefreshCw, Download } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import {
  ProductStatsCards,
  ProductStatsCardsSkeleton,
  ProductsTable,
  ProductsTableSkeleton,
  ProductFilters,
} from "@/components/products";
import type { ProductStatsData } from "@/components/products/product-stats-cards";

// ─── Types ───────────────────────────────────────────

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

interface ProductsResponse {
  data: ProductItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Status Distribution Bar ─────────────────────────

function StatusDistribution({ stats }: { stats: ProductStatsData }) {
  const statuses = [
    { key: "active", label: "Active", color: "#10b981", count: stats.byStatus.active },
    { key: "inactive", label: "Inactive", color: "#6b7280", count: stats.byStatus.inactive },
    { key: "outOfStock", label: "Out of Stock", color: "#ef4444", count: stats.byStatus.outOfStock },
  ].filter((s) => s.count > 0);

  if (stats.total === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {/* Bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted/60">
        {statuses.map((s) => (
          <div
            key={s.key}
            style={{
              backgroundColor: s.color,
              width: `${(s.count / stats.total) * 100}%`,
            }}
            title={`${s.label}: ${s.count}`}
            className="transition-all duration-500"
          />
        ))}
      </div>
      {/* Labels */}
      <div className="flex flex-wrap gap-3">
        {statuses.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-[11px] text-muted-foreground">
              {s.label}{" "}
              <span className="font-medium text-foreground">{s.count}</span>
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────

export default function ProductsPage() {
  const [stats, setStats] = useState<ProductStatsData | null>(null);
  const [productsData, setProductsData] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [featured, setFeatured] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, featured, startDate, endDate]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<ProductStatsData>("admin/products/stats");
      setStats(res.data);
    } catch {
      // silently fail
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        page,
        limit: 20,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (status) params.status = status;
      if (featured) params.isFeatured = featured;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get<ProductsResponse>("admin/products", params);
      setProductsData(res.data);
    } catch {
      // silently fail
    }
  }, [page, debouncedSearch, status, featured, startDate, endDate]);

  const fetchAll = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        await Promise.allSettled([fetchStats(), fetchProducts()]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchStats, fetchProducts],
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Refetch products when filters/page change
  useEffect(() => {
    if (!loading) {
      fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, status, featured, startDate, endDate]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await api.patch(`admin/products/${id}/status`, { status: newStatus });
      toast.success(`Product status updated to ${newStatus.replace(/_/g, " ")}`);
      await Promise.allSettled([fetchProducts(), fetchStats()]);
    } catch {
      toast.error("Failed to update product status");
    }
  };

  const handleToggleFeatured = async (id: string, isFeatured: boolean) => {
    try {
      await api.patch(`admin/products/${id}/featured`, { isFeatured });
      toast.success(isFeatured ? "Product marked as featured" : "Product removed from featured");
      await Promise.allSettled([fetchProducts(), fetchStats()]);
    } catch {
      toast.error("Failed to update featured status");
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const params: Record<string, string | number | boolean | undefined> = {};
      if (status) params.status = status;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get<{ data: any[]; total: number }>(
        "admin/products/export",
        params,
      );

      const rows = res.data.data;
      if (!rows || rows.length === 0) {
        toast.error("No products to export");
        return;
      }

      // Build CSV
      const headers = [
        "Name",
        "Name (AR)",
        "Slug",
        "Price",
        "Sale Price",
        "Quantity",
        "Status",
        "Currency",
        "SKU",
        "Featured",
        "Has Variants",
        "Store",
        "Category",
        "Orders",
        "Reviews",
        "Variants",
        "Created At",
        "Updated At",
      ];

      const escapeCSV = (val: any) => {
        const str = String(val ?? "");
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows = [
        headers.join(","),
        ...rows.map((r: any) =>
          [
            r.name,
            r.nameAr,
            r.slug,
            r.price,
            r.salePrice,
            r.quantity,
            r.status,
            r.currency,
            r.sku,
            r.isFeatured,
            r.hasVariants,
            r.storeName,
            r.categoryName,
            r.ordersCount,
            r.reviewsCount,
            r.variantsCount,
            r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US") : "",
            r.updatedAt ? new Date(r.updatedAt).toLocaleDateString("en-US") : "",
          ]
            .map(escapeCSV)
            .join(","),
        ),
      ];

      // BOM for Excel Arabic support
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvRows.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const dateLabel =
        startDate || endDate
          ? `_${startDate || "start"}_to_${endDate || "now"}`
          : "_all";
      a.download = `products${dateLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${rows.length} products`);
    } catch {
      toast.error("Failed to export products");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete product "${name}"? This action cannot be undone.`,
      )
    )
      return;
    try {
      await api.delete(`admin/products/${id}`);
      toast.success(`Product "${name}" deleted`);
      await Promise.allSettled([fetchProducts(), fetchStats()]);
    } catch {
      toast.error("Failed to delete product");
    }
  };

  return (
    <div className="relative flex h-[calc(100%-1rem)] flex-1 min-w-0 gap-4 m-2 md:ms-0">
      <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="p-4 sm:p-6 space-y-5 pb-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Tag className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">Products</h1>
                  <p className="text-xs text-muted-foreground">
                    Manage all platform products
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition-all disabled:opacity-50"
                >
                  <Download
                    className={`h-3.5 w-3.5 ${exporting ? "animate-bounce" : ""}`}
                  />
                  {exporting ? "Exporting..." : "Export CSV"}
                </button>
                <button
                  onClick={() => fetchAll(true)}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-muted/40 hover:bg-muted/60 text-muted-foreground transition-all disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>
            </div>

            {/* Stats */}
            {loading ? (
              <ProductStatsCardsSkeleton />
            ) : stats ? (
              <ProductStatsCards stats={stats} />
            ) : null}

            {/* Status Distribution */}
            {stats && stats.total > 0 && <StatusDistribution stats={stats} />}

            {/* Filters */}
            <ProductFilters
              search={search}
              onSearchChange={setSearch}
              status={status}
              onStatusChange={setStatus}
              featured={featured}
              onFeaturedChange={setFeatured}
              startDate={startDate}
              onStartDateChange={setStartDate}
              endDate={endDate}
              onEndDateChange={setEndDate}
            />

            {/* Table */}
            {loading ? (
              <ProductsTableSkeleton />
            ) : productsData ? (
              <ProductsTable
                products={productsData.data}
                total={productsData.total}
                page={productsData.page}
                totalPages={productsData.totalPages}
                onPageChange={setPage}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                onToggleFeatured={handleToggleFeatured}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
