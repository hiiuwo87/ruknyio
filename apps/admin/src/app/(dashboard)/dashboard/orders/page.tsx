"use client";

/**
 * 📦 Admin Orders Dashboard
 * Main orders management page with stats, filters, and table
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/client";
import { ShoppingBag, RefreshCw, Download } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import {
  OrderStatsCards,
  OrderStatsCardsSkeleton,
  OrdersTable,
  OrdersTableSkeleton,
  OrderFilters,
} from "@/components/orders";
import type { OrderStatsData } from "@/components/orders/order-stats-cards";

// ─── Types ───────────────────────────────────────────

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

interface OrdersResponse {
  data: OrderItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Status Distribution Bar ─────────────────────────

function StatusDistribution({ stats }: { stats: OrderStatsData }) {
  const statuses = [
    { key: "pending", label: "Pending", color: "#f59e0b", count: stats.byStatus.pending },
    { key: "confirmed", label: "Confirmed", color: "#3b82f6", count: stats.byStatus.confirmed },
    { key: "processing", label: "Processing", color: "#6366f1", count: stats.byStatus.processing },
    { key: "shipped", label: "Shipped", color: "#8b5cf6", count: stats.byStatus.shipped },
    { key: "outForDelivery", label: "On the way", color: "#06b6d4", count: stats.byStatus.outForDelivery },
    { key: "delivered", label: "Delivered", color: "#10b981", count: stats.byStatus.delivered },
    { key: "cancelled", label: "Cancelled", color: "#ef4444", count: stats.byStatus.cancelled },
    { key: "refunded", label: "Refunded", color: "#6b7280", count: stats.byStatus.refunded },
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

export default function OrdersPage() {
  const [stats, setStats] = useState<OrderStatsData | null>(null);
  const [ordersData, setOrdersData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
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
  }, [debouncedSearch, status, startDate, endDate]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<OrderStatsData>("admin/orders/stats");
      setStats(res.data);
    } catch {
      // silently fail
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        page,
        limit: 20,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (status) params.status = status;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get<OrdersResponse>("admin/orders", params);
      setOrdersData(res.data);
    } catch {
      // silently fail
    }
  }, [page, debouncedSearch, status, startDate, endDate]);

  const fetchAll = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        await Promise.allSettled([fetchStats(), fetchOrders()]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchStats, fetchOrders],
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Refetch orders when filters/page change
  useEffect(() => {
    if (!loading) {
      fetchOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, status, startDate, endDate]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await api.put(`admin/orders/${id}/status`, { status: newStatus });
      toast.success(`Order status updated to ${newStatus.replace(/_/g, " ")}`);
      await Promise.allSettled([fetchOrders(), fetchStats()]);
    } catch {
      toast.error("Failed to update order status");
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
        "admin/orders/export",
        params,
      );

      const rows = res.data.data;
      if (!rows || rows.length === 0) {
        toast.error("No orders to export");
        return;
      }

      // Build CSV
      const headers = [
        "Order Number",
        "Status",
        "Customer",
        "Email",
        "Phone",
        "Store",
        "Items",
        "Subtotal",
        "Shipping",
        "Discount",
        "Total",
        "Currency",
        "City",
        "District",
        "Street",
        "Customer Note",
        "Store Note",
        "Cancellation Reason",
        "Created At",
        "Delivered At",
        "Cancelled At",
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
            r.orderNumber,
            r.status,
            r.customerName,
            r.customerEmail,
            r.phone,
            r.storeName,
            r.itemsCount,
            r.subtotal,
            r.shippingFee,
            r.discount,
            r.total,
            r.currency,
            r.city,
            r.district,
            r.street,
            r.customerNote,
            r.storeNote,
            r.cancellationReason,
            r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US") : "",
            r.deliveredAt ? new Date(r.deliveredAt).toLocaleDateString("en-US") : "",
            r.cancelledAt ? new Date(r.cancelledAt).toLocaleDateString("en-US") : "",
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
      a.download = `orders${dateLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${rows.length} orders`);
    } catch {
      toast.error("Failed to export orders");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id: string, orderNumber: string) => {
    if (
      !confirm(
        `Are you sure you want to delete order "${orderNumber}"? This action cannot be undone.`,
      )
    )
      return;
    try {
      await api.delete(`admin/orders/${id}`);
      toast.success(`Order "${orderNumber}" deleted`);
      await Promise.allSettled([fetchOrders(), fetchStats()]);
    } catch {
      toast.error("Failed to delete order");
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
                  <ShoppingBag className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">Orders</h1>
                  <p className="text-xs text-muted-foreground">
                    Manage all platform orders
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
              <OrderStatsCardsSkeleton />
            ) : stats ? (
              <OrderStatsCards stats={stats} />
            ) : null}

            {/* Status Distribution */}
            {stats && stats.total > 0 && <StatusDistribution stats={stats} />}

            {/* Filters */}
            <OrderFilters
              search={search}
              onSearchChange={setSearch}
              status={status}
              onStatusChange={setStatus}
              startDate={startDate}
              onStartDateChange={setStartDate}
              endDate={endDate}
              onEndDateChange={setEndDate}
            />

            {/* Table */}
            {loading ? (
              <OrdersTableSkeleton />
            ) : ordersData ? (
              <OrdersTable
                orders={ordersData.data}
                total={ordersData.total}
                page={ordersData.page}
                totalPages={ordersData.totalPages}
                onPageChange={setPage}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
