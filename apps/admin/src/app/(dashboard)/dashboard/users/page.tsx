"use client";

/**
 * 👥 Admin Users Dashboard
 * Main users management page with stats, filters, role distribution, and table
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/client";
import { Users, RefreshCw, Download } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import {
  UserStatsCards,
  UserStatsCardsSkeleton,
  UsersTable,
  UsersTableSkeleton,
  UserFilters,
} from "@/components/users";
import type { UserStatsData } from "@/components/users/user-stats-cards";

// ─── Types ───────────────────────────────────────────

interface UserItem {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
  profileCompleted: boolean;
  twoFactorEnabled: boolean;
  phoneNumber?: string;
  lastLoginAt: string | null;
  createdAt: string;
  accountType: string;
  hasGoogle: boolean;
  name: string | null;
  username: string | null;
  avatar: string | null;
  eventsCount: number;
  formsCount: number;
  ordersCount: number;
  sessionsCount: number;
  postsCount: number;
}

interface UsersResponse {
  data: UserItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Role Distribution Bar ──────────────────────────

function RoleDistribution({ stats }: { stats: UserStatsData }) {
  const roles = [
    { key: "admin", label: "Admin", color: "#e11d48", count: stats.byRole.admin },
    { key: "premium", label: "Premium", color: "#f59e0b", count: stats.byRole.premium },
    { key: "basic", label: "Basic", color: "#3b82f6", count: stats.byRole.basic },
    { key: "guest", label: "Guest", color: "#6b7280", count: stats.byRole.guest },
  ].filter((r) => r.count > 0);

  if (stats.total === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {/* Bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted/60">
        {roles.map((r) => (
          <div
            key={r.key}
            style={{
              backgroundColor: r.color,
              width: `${(r.count / stats.total) * 100}%`,
            }}
            title={`${r.label}: ${r.count}`}
            className="transition-all duration-500"
          />
        ))}
      </div>
      {/* Labels */}
      <div className="flex flex-wrap gap-3">
        {roles.map((r) => (
          <div key={r.key} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: r.color }}
            />
            <span className="text-[11px] text-muted-foreground">
              {r.label}{" "}
              <span className="font-medium text-foreground">{r.count}</span>
            </span>
          </div>
        ))}
        {/* Verification rate */}
        <span className="text-[11px] text-muted-foreground ml-auto">
          Verification rate:{" "}
          <span className="font-medium text-foreground">
            {stats.verificationRate}%
          </span>
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────

export default function UsersPage() {
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [usersData, setUsersData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [verified, setVerified] = useState("");
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
  }, [debouncedSearch, role, verified, startDate, endDate]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<UserStatsData>("admin/users/stats");
      setStats(res.data);
    } catch {
      // silently fail
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        page,
        limit: 20,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (role) params.role = role;
      if (verified === "true") params.emailVerified = true;
      if (verified === "false") params.emailVerified = false;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get<UsersResponse>("admin/users", params);
      setUsersData(res.data);
    } catch {
      // silently fail
    }
  }, [page, debouncedSearch, role, verified, startDate, endDate]);

  const fetchAll = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        await Promise.allSettled([fetchStats(), fetchUsers()]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchStats, fetchUsers],
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Refetch users when filters/page change
  useEffect(() => {
    if (!loading) {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, role, verified, startDate, endDate]);

  const handleRoleChange = async (id: string, newRole: string) => {
    if (
      !confirm(
        `Are you sure you want to change this user's role to ${newRole}?`,
      )
    )
      return;
    try {
      await api.patch(`admin/users/${id}/role`, { role: newRole });
      toast.success(`User role updated to ${newRole}`);
      await Promise.allSettled([fetchUsers(), fetchStats()]);
    } catch {
      toast.error("Failed to update user role");
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (
      !confirm(
        `Are you sure you want to delete user "${email}"? This action cannot be undone.`,
      )
    )
      return;
    try {
      await api.delete(`admin/users/${id}`);
      toast.success(`User "${email}" deleted`);
      await Promise.allSettled([fetchUsers(), fetchStats()]);
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const params: Record<string, string | number | boolean | undefined> = {};
      if (role) params.role = role;
      if (verified === "true") params.emailVerified = true;
      if (verified === "false") params.emailVerified = false;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get<{ data: any[]; total: number }>(
        "admin/users/export",
        params,
      );

      const rows = res.data.data;
      if (!rows || rows.length === 0) {
        toast.error("No users to export");
        return;
      }

      // Build CSV
      const headers = [
        "Name",
        "Username",
        "Email",
        "Role",
        "Email Verified",
        "Profile Completed",
        "2FA Enabled",
        "Phone",
        "Account Type",
        "Orders",
        "Events",
        "Forms",
        "Posts",
        "Last Login",
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
            r.username,
            r.email,
            r.role,
            r.emailVerified,
            r.profileCompleted,
            r.twoFactorEnabled,
            r.phone,
            r.accountType,
            r.ordersCount,
            r.eventsCount,
            r.formsCount,
            r.postsCount,
            r.lastLoginAt
              ? new Date(r.lastLoginAt).toLocaleDateString("en-US")
              : "",
            r.createdAt
              ? new Date(r.createdAt).toLocaleDateString("en-US")
              : "",
            r.updatedAt
              ? new Date(r.updatedAt).toLocaleDateString("en-US")
              : "",
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
      a.download = `users${dateLabel}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${rows.length} users`);
    } catch {
      toast.error("Failed to export users");
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
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">Users</h1>
                  <p className="text-xs text-muted-foreground">
                    Manage all platform users and roles
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
              <UserStatsCardsSkeleton />
            ) : stats ? (
              <UserStatsCards stats={stats} />
            ) : null}

            {/* Role Distribution */}
            {stats && stats.total > 0 && <RoleDistribution stats={stats} />}

            {/* Filters */}
            <UserFilters
              search={search}
              onSearchChange={setSearch}
              role={role}
              onRoleChange={setRole}
              verified={verified}
              onVerifiedChange={setVerified}
              startDate={startDate}
              onStartDateChange={setStartDate}
              endDate={endDate}
              onEndDateChange={setEndDate}
            />

            {/* Table */}
            {loading ? (
              <UsersTableSkeleton />
            ) : usersData ? (
              <UsersTable
                users={usersData.data}
                total={usersData.total}
                page={usersData.page}
                totalPages={usersData.totalPages}
                onPageChange={setPage}
                onDelete={handleDelete}
                onRoleChange={handleRoleChange}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
