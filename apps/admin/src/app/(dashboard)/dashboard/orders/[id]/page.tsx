"use client";

/**
 * 📦 Order Detail Page
 * Admin view for a single order
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

import { OrderDetails, OrderDetailsSkeleton } from "@/components/orders";

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<any>(`admin/orders/${orderId}`);
      setOrder(res.data);
    } catch {
      toast.error("Failed to load order details");
      router.push("/dashboard/orders");
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleStatusChange = async (status: string) => {
    try {
      await api.put(`admin/orders/${orderId}/status`, { status });
      toast.success(`Order status updated to ${status.replace(/_/g, " ")}`);
      await fetchOrder();
    } catch {
      toast.error("Failed to update order status");
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete this order? This action cannot be undone.`,
      )
    )
      return;
    try {
      await api.delete(`admin/orders/${orderId}`);
      toast.success("Order deleted");
      router.push("/dashboard/orders");
    } catch {
      toast.error("Failed to delete order");
    }
  };

  return (
    <div className="relative flex h-[calc(100%-1rem)] flex-1 min-w-0 gap-4 m-2 md:ms-0">
      <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="p-4 sm:p-6 pb-6">
            {loading ? (
              <OrderDetailsSkeleton />
            ) : order ? (
              <OrderDetails
                order={order}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
