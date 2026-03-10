"use client";

/**
 * 📊 Dashboard Header Component
 * رأس لوحة التحكم - تصميم بسيط ومتناسق
 */

import {
  Package,
  FileText,
  Tag,
  Megaphone,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  storeName?: string;
  hasStore?: boolean;
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  onRefresh?: () => void;
}


const quickAddOptions = [
  { icon: Package, label: "منتج جديد", href: "/app/store/products/new", color: "bg-emerald-500" },
  { icon: FileText, label: "نموذج جديد", href: "/app/forms/create?new=true", color: "bg-sky-500" },
  { icon: Tag, label: "كوبون جديد", href: "/app/coupons/new", color: "bg-amber-500" },
  { icon: Megaphone, label: "فعالية جديدة", href: "/app/events/create", color: "bg-violet-500" },
];

export function DashboardHeader({
  dateRange,
  onDateRangeChange,
}: DashboardHeaderProps) {
  const [showDate, setShowDate] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const quickAddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (dateRef.current && !dateRef.current.contains(t)) setShowDate(false);
      if (quickAddRef.current && !quickAddRef.current.contains(t)) setShowQuickAdd(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  return (
    <header className="flex items-center justify-between gap-4">
      {/* Title */}
      <div>
        <h1 className="text-lg font-bold text-foreground">الرئيسية</h1>
        <p className="text-sm text-muted-foreground">تابع نشاط متجرك وإحصائياتك</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Quick Add */}
        <div className="relative" ref={quickAddRef}>
          <button
            type="button"
            onClick={() => { setShowQuickAdd((v) => !v); setShowDate(false); }}
            className="flex h-9 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">إضافة</span>
          </button>

          {showQuickAdd && (
            <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-xl border border-border/50 bg-card p-1 shadow-lg">
              {quickAddOptions.map((opt) => (
                <Link
                  key={opt.href}
                  href={opt.href}
                  onClick={() => setShowQuickAdd(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                >
                  <div className={cn("p-1.5 rounded-md", opt.color)}>
                    <opt.icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span>{opt.label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function DashboardHeaderSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-1.5">
        <div className="h-5 w-20 rounded bg-muted animate-pulse" />
        <div className="h-4 w-40 rounded bg-muted animate-pulse" />
      </div>
      <div className="h-9 w-9 sm:w-24 rounded-xl bg-muted animate-pulse" />
    </div>
  );
}