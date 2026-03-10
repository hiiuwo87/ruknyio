"use client";

/**
 * 📊 Admin Dashboard — Home
 * Real-time platform stats with design matching the web app dashboard
 */

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/providers";
import { api } from "@/lib/api/client";
import Link from "next/link";
import {
  Users,
  Store,
  FileText,
  CalendarDays,
  ShoppingBag,
  Shield,
  Settings,
  UserPlus,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";

import {
  StatsCard,
  StatsCardSkeleton,
  OverviewStats,
  OverviewStatsSkeleton,
  ActivityBarChart,
  ActivityBarChartSkeleton,
  RecentActivity,
  RecentActivitySkeleton,
  SystemHealth,
  SystemHealthSkeleton,
  DashboardHeader,
  DashboardHeaderSkeleton,
  timeAgo,
} from "@/components/dashboard";

// ─── Types ───────────────────────────────────────────

interface PlatformStats {
  users: { total: number; newToday: number; newThisWeek: number; newThisMonth: number };
  stores: { total: number; active: number };
  forms: { total: number; active: number };
  events: { total: number; active: number };
  orders: { total: number };
}

interface ActivityItemRaw {
  id: string;
  type: "user_signup" | "store_created" | "form_created" | "event_created";
  title: string;
  subtitle: string;
  avatar?: string;
  status?: string;
  createdAt: string;
}

interface SystemHealthData {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  timestamp: string;
  environment: string;
  services: {
    database: { status: string; responseTime: number };
    redis: { status: string; responseTime: number };
  };
  memory: { used: number; total: number; rss: number };
  latency: number;
}

// ─── Helpers ─────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return (n ?? 0).toLocaleString("en-US");
}

// ─── Quick Nav Items ─────────────────────────────────

const quickNav = [
  { label: "Users", href: "/dashboard/users", icon: Users, color: "bg-blue-500/10 text-blue-600", desc: "Manage all users" },
  { label: "Stores", href: "/dashboard/stores", icon: Store, color: "bg-emerald-500/10 text-emerald-600", desc: "View all stores" },
  { label: "Forms", href: "/dashboard/forms", icon: FileText, color: "bg-violet-500/10 text-violet-600", desc: "Form submissions" },
  { label: "Events", href: "/dashboard/events", icon: CalendarDays, color: "bg-amber-500/10 text-amber-600", desc: "Manage events" },
  { label: "Security", href: "/dashboard/security", icon: Shield, color: "bg-rose-500/10 text-rose-600", desc: "Security logs" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, color: "bg-slate-500/10 text-slate-600", desc: "Platform settings" },
];

// ─── Main Component ──────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [activity, setActivity] = useState<ActivityItemRaw[]>([]);
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [statsRes, activityRes, healthRes] = await Promise.allSettled([
        api.get<PlatformStats>("admin/stats"),
        api.get<ActivityItemRaw[]>("admin/recent-activity", { limit: 10 }),
        api.get<SystemHealthData>("admin/health"),
      ]);

      if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
      if (activityRes.status === "fulfilled") setActivity(activityRes.value.data);
      if (healthRes.status === "fulfilled") setHealth(healthRes.value.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  // ── Stats cards data ──
  const statsData = stats
    ? [
        {
          title: "Users",
          value: formatNumber(stats.users.total),
          change: stats.users.newToday > 0 ? `+${stats.users.newToday} today` : "+0 today",
          trend: "up" as const,
          icon: Users,
        },
        {
          title: "Stores",
          value: formatNumber(stats.stores.total),
          change: stats.stores.active > 0 ? `${stats.stores.active} active` : "0 active",
          trend: "up" as const,
          icon: Store,
        },
        {
          title: "Forms",
          value: formatNumber(stats.forms.total),
          change: stats.forms.active > 0 ? `${stats.forms.active} published` : "0 published",
          trend: "up" as const,
          icon: FileText,
        },
        {
          title: "Events",
          value: formatNumber(stats.events.total),
          change: stats.events.active > 0 ? `${stats.events.active} active` : "0 active",
          trend: "up" as const,
          icon: CalendarDays,
        },
        {
          title: "Orders",
          value: formatNumber(stats.orders.total),
          change: "All time",
          trend: "up" as const,
          icon: ShoppingBag,
        },
      ]
    : [];

  // ── Overview stats (bar chart columns) ──
  const overviewData = stats
    ? [
        {
          label: "Users",
          value: stats.users.total,
          change: stats.users.newThisMonth > 0
            ? Number(((stats.users.newThisMonth / Math.max(stats.users.total, 1)) * 100).toFixed(1))
            : 0,
        },
        {
          label: "Stores",
          value: stats.stores.total,
          change: stats.stores.active > 0
            ? Number(((stats.stores.active / Math.max(stats.stores.total, 1)) * 100).toFixed(1))
            : 0,
        },
        {
          label: "Forms",
          value: stats.forms.total,
          change: stats.forms.active > 0
            ? Number(((stats.forms.active / Math.max(stats.forms.total, 1)) * 100).toFixed(1))
            : 0,
          highlight: true,
        },
        {
          label: "Events",
          value: stats.events.total,
          change: stats.events.active > 0
            ? Number(((stats.events.active / Math.max(stats.events.total, 1)) * 100).toFixed(1))
            : 0,
        },
      ]
    : [];

  // ── Growth chart data ──
  const growthChartData = stats
    ? [
        { day: "Today", value: stats.users.newToday, isHighlighted: true },
        { day: "Week", value: stats.users.newThisWeek, isHighlighted: false },
        { day: "Month", value: stats.users.newThisMonth, isHighlighted: false },
        { day: "Users", value: stats.users.total, isHighlighted: false },
        { day: "Stores", value: stats.stores.total, isHighlighted: false },
        { day: "Forms", value: stats.forms.total, isHighlighted: false },
        { day: "Events", value: stats.events.total, isHighlighted: false },
      ]
    : undefined;

  // ── Activity items ──
  const activityItems = activity.map((item, index) => ({
    id: item.id,
    title: item.title,
    description: item.subtitle,
    type: item.type,
    time: timeAgo(item.createdAt),
    isNew: index === 0,
  }));

  return (
    <div className="relative flex h-[calc(100%-1rem)] flex-1 min-w-0 gap-4 m-2 md:ms-0">
      {/* Main Content */}
      <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="p-4 sm:p-6 space-y-5 pb-6">
            {/* ── Header ──────────────────────── */}
            {loading ? (
              <DashboardHeaderSkeleton />
            ) : (
              <DashboardHeader
                greeting={greeting}
                userName={user?.name}
                refreshing={refreshing}
                onRefresh={() => fetchData(true)}
              />
            )}

            {/* ── Stats Cards ─────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <StatsCardSkeleton key={i} />)
                : statsData.map((stat, index) => (
                    <StatsCard key={index} {...stat} highlight={index === 0} />
                  ))}
            </div>

            {/* ── Overview & Growth Chart ─────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {loading ? (
                <>
                  <OverviewStatsSkeleton />
                  <ActivityBarChartSkeleton />
                </>
              ) : (
                <>
                  <OverviewStats
                    title="Platform Overview"
                    subtitle="Real-time counts across all services"
                    stats={overviewData}
                  />
                  <ActivityBarChart
                    title="User Growth"
                    totalValue={formatNumber(stats?.users.total || 0)}
                    totalLabel="Total registered users"
                    data={growthChartData}
                    badge={{
                      value: `+${stats?.users.newThisMonth || 0}`,
                      trend: "up",
                    }}
                  />
                </>
              )}
            </div>

            {/* ── Activity & System Health ────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {loading ? (
                <>
                  <RecentActivitySkeleton />
                  <SystemHealthSkeleton />
                </>
              ) : (
                <>
                  <RecentActivity
                    title="Recent Activity"
                    items={activityItems}
                  />
                  <SystemHealth data={health} />
                </>
              )}
            </div>

            {/* ── Quick Navigation ────────────── */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Quick Navigation</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {quickNav.map((item, index) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      href={item.href}
                      className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-all"
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.color} transition-transform group-hover:scale-110`}>
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* ── Growth Overview Row ─────────── */}
            {stats && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="rounded-3xl bg-muted/30 p-5 sm:p-6"
              >
                <h3 className="text-base font-bold text-foreground mb-4">Growth Overview</h3>
                <div className="grid grid-cols-3 gap-4">
                  <GrowthMetric
                    label="Today"
                    value={stats.users.newToday}
                    icon={UserPlus}
                  />
                  <GrowthMetric
                    label="This Week"
                    value={stats.users.newThisWeek}
                    icon={TrendingUp}
                  />
                  <GrowthMetric
                    label="This Month"
                    value={stats.users.newThisMonth}
                    icon={BarChart3}
                  />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Growth Metric Sub-Component ─────────────────────

function GrowthMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-1 p-4 rounded-2xl bg-card"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-bold tracking-tight tabular-nums">
        {formatNumber(value)}
      </p>
      <p className="text-[10px] text-muted-foreground">new users</p>
    </motion.div>
  );
}
