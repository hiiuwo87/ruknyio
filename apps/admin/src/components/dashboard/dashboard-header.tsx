"use client";

import { LayoutDashboard, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  greeting: string;
  userName?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function DashboardHeader({
  greeting,
  userName,
  refreshing,
  onRefresh,
}: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4">
      <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
        <div className="flex items-center gap-2 text-muted-foreground">
          <LayoutDashboard className="h-4 w-4" />
          <span>Admin Panel</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50" aria-hidden />
        <span className="font-medium text-foreground">Dashboard</span>
      </nav>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {greeting}
          {userName ? `, ${userName}` : ""}
        </span>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors",
              refreshing && "opacity-70 cursor-not-allowed"
            )}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}
      </div>
    </header>
  );
}

export function DashboardHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-20 rounded bg-muted animate-pulse" />
        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-14 rounded bg-muted animate-pulse" />
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-9 sm:w-32 rounded-lg bg-muted animate-pulse" />
      </div>
    </div>
  );
}
