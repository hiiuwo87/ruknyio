"use client";

import { motion } from "framer-motion";
import {
  Database,
  HardDrive,
  Server,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface SystemHealthProps {
  data: SystemHealthData | null;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const statusConfig = {
  healthy: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500", label: "All Systems Operational" },
  degraded: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500", label: "Degraded Performance" },
  unhealthy: { icon: XCircle, color: "text-rose-500", bg: "bg-rose-500", label: "System Issues" },
};

export function SystemHealth({ data }: SystemHealthProps) {
  if (!data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="rounded-3xl bg-muted/30 p-5 sm:p-6"
      >
        <h3 className="text-base font-bold text-foreground mb-4">System Health</h3>
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Server className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">Unable to fetch health data</p>
        </div>
      </motion.div>
    );
  }

  const config = statusConfig[data.status] || statusConfig.healthy;
  const StatusIcon = config.icon;
  const memPercent = data.memory.total > 0 ? (data.memory.used / data.memory.total) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-3xl bg-muted/30 p-5 sm:p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-foreground">System Health</h3>
        <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border/50")}>
          <div className={cn("w-2 h-2 rounded-full", config.bg)} />
          <span className="text-xs font-medium text-foreground">{config.label}</span>
        </div>
      </div>

      {/* Services */}
      <div className="space-y-3">
        {/* Database */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted/60 shrink-0">
            <Database className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Database</p>
            <p className="text-xs text-muted-foreground">{data.services.database.responseTime}ms response</p>
          </div>
          <div className={cn(
            "w-2.5 h-2.5 rounded-full shrink-0",
            data.services.database.status === "healthy" ? "bg-emerald-500" : "bg-rose-500"
          )} />
        </div>

        {/* Redis */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted/60 shrink-0">
            <HardDrive className="w-4 h-4 text-violet-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Redis Cache</p>
            <p className="text-xs text-muted-foreground">{data.services.redis.responseTime}ms response</p>
          </div>
          <div className={cn(
            "w-2.5 h-2.5 rounded-full shrink-0",
            data.services.redis.status === "healthy" ? "bg-emerald-500" : "bg-rose-500"
          )} />
        </div>

        {/* Memory */}
        <div className="px-4 py-3 rounded-2xl bg-card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">Memory Usage</p>
            <span className="text-xs text-muted-foreground">
              {data.memory.used}MB / {data.memory.total}MB
            </span>
          </div>
          <div className="w-full h-2 bg-muted/60 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${memPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                memPercent > 80 ? "bg-rose-500" : memPercent > 60 ? "bg-amber-500" : "bg-[#c8e972]"
              )}
            />
          </div>
        </div>

        {/* Uptime & Environment */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="text-sm font-bold text-foreground">{formatUptime(data.uptime)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card">
            <Server className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Environment</p>
              <p className="text-sm font-bold text-foreground capitalize">{data.environment}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function SystemHealthSkeleton() {
  return (
    <div className="rounded-3xl bg-muted/30 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="h-5 w-28 bg-muted/60 rounded animate-pulse" />
        <div className="h-7 w-36 bg-muted/60 rounded-full animate-pulse" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card">
            <div className="w-8 h-8 rounded-full bg-muted/60 animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-20 bg-muted/60 rounded animate-pulse" />
              <div className="h-3 w-28 bg-muted/60 rounded animate-pulse" />
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-muted/60 animate-pulse" />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 bg-card rounded-2xl animate-pulse" />
          <div className="h-16 bg-card rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}
