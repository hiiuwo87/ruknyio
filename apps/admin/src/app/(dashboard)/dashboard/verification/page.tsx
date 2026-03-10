"use client";

/**
 * ✅ Admin Verification Dashboard
 * Manage verification requests - stats, filters, table, export
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/client";
import { FileCheck, RefreshCw, Download } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import {
  VerificationStatsCards,
  VerificationStatsCardsSkeleton,
  VerificationTable,
  VerificationTableSkeleton,
  VerificationFilters,
} from "@/components/verification";
import type { VerificationStatsData } from "@/components/verification";

// ─── Types ───────────────────────────────────────────

interface VerificationItem {
  id: string;
  type: string;
  status: string;
  fullName: string;
  businessName: string | null;
  screenshotsCount: number;
  createdAt: string;
  user: {
    id: string;
    email: string;
    role: string;
    isVerified: boolean;
    name: string | null;
    username: string | null;
    avatar: string | null;
  };
}

interface VerificationResponse {
  data: VerificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Status Distribution Bar ────────────────────────

function StatusDistribution({ stats }: { stats: VerificationStatsData }) {
  const statuses = [
    { key: "pending", label: "Pending", color: "#f59e0b", count: stats.byStatus.pending },
    { key: "underReview", label: "Under Review", color: "#3b82f6", count: stats.byStatus.underReview },
    { key: "approved", label: "Approved", color: "#10b981", count: stats.byStatus.approved },
    { key: "rejected", label: "Rejected", color: "#f43f5e", count: stats.byStatus.rejected },
  ].filter((s) => s.count > 0);

  if (stats.total === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
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
        <span className="text-[11px] text-muted-foreground ml-auto">
          Approval rate:{" "}
          <span className="font-medium text-foreground">
            {stats.approvalRate}%
          </span>
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────

export default function VerificationPage() {
  const [stats, setStats] = useState<VerificationStatsData | null>(null);
  const [requestsData, setRequestsData] = useState<VerificationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
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
  }, [debouncedSearch, status, type, startDate, endDate]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<VerificationStatsData>("admin/verification/stats");
      setStats(res.data);
    } catch {
      // silently fail
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const params: Record<string, string | number | undefined> = {
        page,
        limit: 20,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (status) params.status = status;
      if (type) params.type = type;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get<VerificationResponse>("admin/verification", params);
      setRequestsData(res.data);
    } catch {
      // silently fail
    }
  }, [page, debouncedSearch, status, type, startDate, endDate]);

  const fetchAll = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        await Promise.allSettled([fetchStats(), fetchRequests()]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchStats, fetchRequests],
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Refetch requests when filters/page change
  useEffect(() => {
    if (!loading) {
      fetchRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, status, type, startDate, endDate]);

  const handleApprove = async (id: string) => {
    if (!confirm("Approve this verification request?")) return;
    try {
      await api.patch(`admin/verification/${id}`, { action: "approve" });
      toast.success("Verification request approved");
      await Promise.allSettled([fetchRequests(), fetchStats()]);
    } catch {
      toast.error("Failed to approve request");
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    try {
      await api.patch(`admin/verification/${id}`, {
        action: "reject",
        rejectionReason: reason,
      });
      toast.success("Verification request rejected");
      await Promise.allSettled([fetchRequests(), fetchStats()]);
    } catch {
      toast.error("Failed to reject request");
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const params: Record<string, string | undefined> = {};
      if (status) params.status = status;
      if (type) params.type = type;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get<{ data: any[]; total: number }>(
        "admin/verification/export",
        params,
      );

      const rows = res.data.data;
      if (!rows || rows.length === 0) {
        toast.error("No requests to export");
        return;
      }

      const headers = [
        "Full Name",
        "Email",
        "Type",
        "Status",
        "Business Name",
        "Business Email",
        "Screenshots",
        "Notes",
        "Admin Notes",
        "Rejection Reason",
        "Submitted At",
        "Reviewed At",
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
            r.fullName,
            r.userEmail,
            r.type,
            r.status,
            r.businessName,
            r.businessEmail,
            r.screenshotsCount,
            r.notes,
            r.adminNotes,
            r.rejectionReason,
            r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-US") : "",
            r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString("en-US") : "",
          ]
            .map(escapeCSV)
            .join(","),
        ),
      ];

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
      a.download = `verification_requests${dateLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} requests`);
    } catch {
      toast.error("Failed to export");
    } finally {
      setExporting(false);
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
                  <FileCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">Verification</h1>
                  <p className="text-xs text-muted-foreground">
                    Review and manage verification requests
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
              <VerificationStatsCardsSkeleton />
            ) : stats ? (
              <VerificationStatsCards stats={stats} />
            ) : null}

            {/* Status Distribution */}
            {stats && stats.total > 0 && <StatusDistribution stats={stats} />}

            {/* Filters */}
            <VerificationFilters
              search={search}
              onSearchChange={setSearch}
              status={status}
              onStatusChange={setStatus}
              type={type}
              onTypeChange={setType}
              startDate={startDate}
              onStartDateChange={setStartDate}
              endDate={endDate}
              onEndDateChange={setEndDate}
            />

            {/* Table */}
            {loading ? (
              <VerificationTableSkeleton />
            ) : requestsData ? (
              <VerificationTable
                requests={requestsData.data}
                total={requestsData.total}
                page={requestsData.page}
                totalPages={requestsData.totalPages}
                onPageChange={setPage}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
