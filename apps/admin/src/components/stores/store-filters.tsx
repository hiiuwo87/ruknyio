"use client";

/**
 * 🔍 Store Filters
 * Sleek pill-based design — rounded search bar + chip filters
 */

import { Search, X } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StoreCategory {
  id: string;
  name: string;
  nameAr: string;
  color: string;
}

interface StoreFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  categoryId: string;
  onCategoryChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
  categories: StoreCategory[];
  cities: string[];
}

/* ── Pill chip button ─────────────────────────── */
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

export function StoreFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  categoryId,
  onCategoryChange,
  city,
  onCityChange,
  categories,
  cities,
}: StoreFiltersProps) {
  const statusOptions = [
    { value: "", label: "All" },
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
  ];

  return (
    <div className="space-y-4">
      {/* ── Search Bar ──────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground/60" />
        <input
          type="text"
          placeholder="Search stores..."
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

      {/* ── Status Pills ────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((opt) => (
            <Pill
              key={opt.value}
              active={status === opt.value}
              onClick={() => onStatusChange(opt.value)}
            >
              {opt.label}
            </Pill>
          ))}
        </div>

        {/* ── Category Pills ──────────────────────── */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Pill
              active={categoryId === ""}
              onClick={() => onCategoryChange("")}
            >
              All Categories
            </Pill>
            {categories.map((cat) => (
              <Pill
                key={cat.id}
                active={categoryId === cat.id}
                onClick={() => onCategoryChange(cat.id)}
              >
                {cat.nameAr}
              </Pill>
            ))}
          </div>
        )}

        {/* ── City Pills ─────────────────────────── */}
        {cities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Pill active={city === ""} onClick={() => onCityChange("")}>
              All Cities
            </Pill>
            {cities.map((c) => (
              <Pill key={c} active={city === c} onClick={() => onCityChange(c)}>
                {c}
              </Pill>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
