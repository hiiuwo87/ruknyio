"use client";

/**
 * 🔍 User Filters
 * Pill-based design matching the admin panel pattern
 */

import { Search, X, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface UserFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  role: string;
  onRoleChange: (value: string) => void;
  verified: string;
  onVerifiedChange: (value: string) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "relative h-9 px-4 rounded-full text-sm font-medium transition-all duration-200 select-none whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40",
      )}
    >
      {children}
    </motion.button>
  );
}

const roleOptions = [
  { value: "", label: "All Roles" },
  { value: "ADMIN", label: "Admin" },
  { value: "PREMIUM", label: "Premium" },
  { value: "BASIC", label: "Basic" },
  { value: "GUEST", label: "Guest" },
];

const verifiedOptions = [
  { value: "", label: "All" },
  { value: "true", label: "✓ Verified" },
  { value: "false", label: "Unverified" },
];

export function UserFilters({
  search,
  onSearchChange,
  role,
  onRoleChange,
  verified,
  onVerifiedChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
}: UserFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Search by name, email, username, phone..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-12 pl-11 pr-11 rounded-full bg-muted/30 border border-border/40 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Date Filters */}
        <div className="flex gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="h-12 pl-9 pr-3 rounded-full bg-muted/30 border border-border/40 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              placeholder="From"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="h-12 pl-9 pr-3 rounded-full bg-muted/30 border border-border/40 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              placeholder="To"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                onStartDateChange("");
                onEndDateChange("");
              }}
              className="h-12 px-3 rounded-full bg-muted/30 border border-border/40 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Role Pills */}
      <div className="flex flex-wrap gap-2">
        {roleOptions.map((opt) => (
          <Pill
            key={`role-${opt.value}`}
            active={role === opt.value}
            onClick={() => onRoleChange(opt.value)}
          >
            {opt.label}
          </Pill>
        ))}

        <div className="w-px h-9 bg-border/40 mx-1" />

        {verifiedOptions.map((opt) => (
          <Pill
            key={`ver-${opt.value}`}
            active={verified === opt.value}
            onClick={() => onVerifiedChange(opt.value)}
          >
            {opt.label}
          </Pill>
        ))}
      </div>
    </div>
  );
}
