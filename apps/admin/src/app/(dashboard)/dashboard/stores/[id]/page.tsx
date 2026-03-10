"use client";

/**
 * 🔍 Store Details Page
 * Full store view with products, orders, and management actions
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

import { StoreDetails, StoreDetailsSkeleton } from "@/components/stores";

export default function StoreDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const storeId = params.id as string;

  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStore = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<any>(`admin/stores/${storeId}`);
      setStore(res.data);
    } catch {
      toast.error("Failed to load store details");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    if (storeId) fetchStore();
  }, [storeId, fetchStore]);

  const handleToggleStatus = async (newStatus: "ACTIVE" | "INACTIVE") => {
    try {
      await api.patch(`admin/stores/${storeId}/status`, { status: newStatus });
      toast.success(`Store ${newStatus === "ACTIVE" ? "activated" : "deactivated"}`);
      fetchStore();
    } catch {
      toast.error("Failed to update store status");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${store?.name}"? This action cannot be undone.`))
      return;
    try {
      await api.delete(`admin/stores/${storeId}`);
      toast.success("Store deleted successfully");
      router.push("/dashboard/stores");
    } catch {
      toast.error("Failed to delete store");
    }
  };

  return (
    <div className="relative flex h-[calc(100%-1rem)] flex-1 min-w-0 gap-4 m-2 md:ms-0">
      <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="p-4 sm:p-6 space-y-5 pb-6">
            {loading ? (
              <StoreDetailsSkeleton />
            ) : store ? (
              <StoreDetails
                store={store}
                onToggleStatus={handleToggleStatus}
                onDelete={handleDelete}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <p className="text-sm">Store not found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
