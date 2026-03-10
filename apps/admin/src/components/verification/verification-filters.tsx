"use client";

/**
 * 🔍 Verification Filters
 * Status pills + type pills + search + date range
 */

import { Search, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerificationFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  type: string;
  onTypeChange: (v: string) => void;
  startDate: string;
  onStartDateChange: (v: string) => void;
  endDate: string;
  onEndDateChange: (v: string) => void;
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "PERSONAL", label: "Personal" },
  { value: "BUSINESS", label: "Business" },
];

export function VerificationFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  type,
  onTypeChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
}: VerificationFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Search + Date */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-8 pl-9 pr-3 rounded-xl bg-muted/30 border border-border/30 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="h-8 pl-8 pr-2 rounded-xl bg-muted/30 border border-border/30 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="h-8 pl-8 pr-2 rounded-xl bg-muted/30 border border-border/30 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      {/* Status + Type Pills */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onStatusChange(opt.value)}
              className={cn(
                "h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all",
                status === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border/30" />

        <div className="flex items-center gap-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onTypeChange(opt.value)}
              className={cn(
                "h-7 px-2.5 rounded-lg text-[11px] font-medium transition-all",
                type === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
