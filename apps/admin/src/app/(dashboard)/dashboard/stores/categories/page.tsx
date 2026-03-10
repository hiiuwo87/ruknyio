"use client";

/**
 * 📂 Store Categories Management Page
 * CRUD for store categories (types of stores like Restaurant, Electronics, etc.)
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/client";
import { FolderOpen, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import {
  StoreCategoryManager,
  StoreCategoryManagerSkeleton,
} from "@/components/stores";

export default function StoreCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCategories = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await api.get<any[]>("admin/store-categories");
      setCategories(res.data);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreate = async (data: any) => {
    try {
      await api.post("admin/store-categories", data);
      toast.success("Category created");
      fetchCategories();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create category");
      throw err;
    }
  };

  const handleUpdate = async (id: string, data: any) => {
    try {
      await api.put(`admin/store-categories/${id}`, data);
      toast.success("Category updated");
      fetchCategories();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update category");
      throw err;
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await api.delete(`admin/store-categories/${id}`);
      toast.success("Category deleted");
      fetchCategories();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete category");
      throw err;
    }
  };

  const handleImport = async (items: any[]) => {
    let success = 0;
    let failed = 0;
    for (const item of items) {
      try {
        await api.post("admin/store-categories", item);
        success++;
      } catch {
        failed++;
      }
    }
    fetchCategories();
    if (failed > 0) {
      toast.warning(`Imported ${success} categories, ${failed} failed`);
    } else {
      toast.success(`Successfully imported ${success} categories`);
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
                <Link
                  href="/dashboard/stores"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                  <FolderOpen className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">Store Categories</h1>
                  <p className="text-xs text-muted-foreground">
                    Manage store types and classifications
                  </p>
                </div>
              </div>
              <button
                onClick={() => fetchCategories(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-medium bg-muted/40 hover:bg-muted/60 text-muted-foreground transition-all disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {/* Category Manager */}
            {loading ? (
              <StoreCategoryManagerSkeleton />
            ) : (
              <StoreCategoryManager
                categories={categories}
                onCreateCategory={handleCreate}
                onUpdateCategory={handleUpdate}
                onDeleteCategory={handleDelete}
                onImportCategories={handleImport}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
