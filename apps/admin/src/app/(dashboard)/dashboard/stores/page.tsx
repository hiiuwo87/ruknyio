"use client";

/**
 * 🏪 Admin Stores Dashboard
 * Main stores management page with stats, filters, and table
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { Store, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import {
  StoreStatsCards,
  StoreStatsCardsSkeleton,
  StoresTable,
  StoresTableSkeleton,
  StoreFilters,
} from "@/components/stores";

// ─── Types ───────────────────────────────────────────

interface StoreStatsData {
  total: number;
  active: number;
  inactive: number;
  newThisMonth: number;
  newThisWeek: number;
  totalProducts: number;
  totalOrders: number;
  byCategory: Array<{ id: string; name: string; nameAr: string; color: string; count: number }>;
  byCity: Array<{ city: string; count: number }>;
}

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
    profile?: { name: string; username: string; avatar?: string };
  };
  store_categories?: {
    id: string;
    name: string;
    nameAr: string;
    icon?: string;
    color: string;
  };
  _count: { products: number; orders: number; coupons: number };
}

interface StoresResponse {
  data: StoreItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Main Component ──────────────────────────────────

export default function StoresPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StoreStatsData | null>(null);
  const [storesData, setStoresData] = useState<StoresResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [city, setCity] = useState("");
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
  }, [debouncedSearch, status, categoryId, city]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<StoreStatsData>("admin/stores/stats");
      setStats(res.data);
    } catch {
      // silently fail
    }
  }, []);

  const fetchStores = useCallback(async () => {
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        page,
        limit: 20,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (status) params.status = status;
      if (categoryId) params.categoryId = categoryId;
      if (city) params.city = city;

      const res = await api.get<StoresResponse>("admin/stores", params);
      setStoresData(res.data);
    } catch {
      // silently fail
    }
  }, [page, debouncedSearch, status, categoryId, city]);

  const fetchAll = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        await Promise.allSettled([fetchStats(), fetchStores()]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchStats, fetchStores],
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Refetch stores when filters/page change
  useEffect(() => {
    if (!loading) {
      fetchStores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, status, categoryId, city]);

  const handleToggleStatus = async (id: string, newStatus: "ACTIVE" | "INACTIVE") => {
    try {
      await api.patch(`admin/stores/${id}/status`, { status: newStatus });
      toast.success(`Store ${newStatus === "ACTIVE" ? "activated" : "deactivated"}`);
      await Promise.allSettled([fetchStores(), fetchStats()]);
    } catch {
      toast.error("Failed to update store status");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`admin/stores/${id}`);
      toast.success(`Store "${name}" deleted`);
      await Promise.allSettled([fetchStores(), fetchStats()]);
    } catch {
      toast.error("Failed to delete store");
    }
  };

  // Build filter data from stats
  const categories = stats?.byCategory?.map((c) => ({
    id: c.id,
    name: c.name,
    nameAr: c.nameAr,
    color: c.color,
  })) || [];
  const cities = stats?.byCity?.map((c) => c.city) || [];

  return (
    <div className="relative flex h-[calc(100%-1rem)] flex-1 min-w-0 gap-4 m-2 md:ms-0">
      <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="p-4 sm:p-6 space-y-5 pb-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Store className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">Stores</h1>
                  <p className="text-xs text-muted-foreground">
                    Manage all platform stores
                  </p>
                </div>
              </div>
              <button
                onClick={() => fetchAll(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-muted/40 hover:bg-muted/60 text-muted-foreground transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {/* Stats */}
            {loading ? (
              <StoreStatsCardsSkeleton />
            ) : stats ? (
              <StoreStatsCards stats={stats} />
            ) : null}

            {/* Distribution Badges */}
            {stats && stats.byCategory.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-2"
              >
                {stats.byCategory.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryId(categoryId === cat.id ? "" : cat.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                      categoryId === cat.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/30 hover:border-border/60"
                    }`}
                    style={
                      categoryId !== cat.id
                        ? { backgroundColor: `${cat.color}08`, color: cat.color }
                        : undefined
                    }
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.nameAr}
                    <span className="text-[10px] opacity-70">{cat.count}</span>
                  </button>
                ))}
              </motion.div>
            )}

            {/* Filters */}
            <StoreFilters
              search={search}
              onSearchChange={setSearch}
              status={status}
              onStatusChange={setStatus}
              categoryId={categoryId}
              onCategoryChange={setCategoryId}
              city={city}
              onCityChange={setCity}
              categories={categories}
              cities={cities}
            />

            {/* Table */}
            {loading ? (
              <StoresTableSkeleton />
            ) : storesData ? (
              <StoresTable
                stores={storesData.data}
                total={storesData.total}
                page={storesData.page}
                totalPages={storesData.totalPages}
                onPageChange={setPage}
                onToggleStatus={handleToggleStatus}
                onDelete={handleDelete}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
