"use client";

/**
 * 📦 Product Detail Page
 * Admin view for a single product
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { toast } from "sonner";

import { ProductDetails, ProductDetailsSkeleton } from "@/components/products";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<any>(`admin/products/${productId}`);
      setProduct(res.data);
    } catch {
      toast.error("Failed to load product details");
      router.push("/dashboard/products");
    } finally {
      setLoading(false);
    }
  }, [productId, router]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleStatusChange = async (status: string) => {
    try {
      await api.patch(`admin/products/${productId}/status`, { status });
      toast.success(`Product status updated to ${status.replace(/_/g, " ")}`);
      await fetchProduct();
    } catch {
      toast.error("Failed to update product status");
    }
  };

  const handleToggleFeatured = async (isFeatured: boolean) => {
    try {
      await api.patch(`admin/products/${productId}/featured`, { isFeatured });
      toast.success(
        isFeatured ? "Product marked as featured" : "Product removed from featured",
      );
      await fetchProduct();
    } catch {
      toast.error("Failed to update featured status");
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this product? This action cannot be undone.",
      )
    )
      return;
    try {
      await api.delete(`admin/products/${productId}`);
      toast.success("Product deleted");
      router.push("/dashboard/products");
    } catch {
      toast.error("Failed to delete product");
    }
  };

  return (
    <div className="relative flex h-[calc(100%-1rem)] flex-1 min-w-0 gap-4 m-2 md:ms-0">
      <div className="flex-1 min-w-0 bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="p-4 sm:p-6 pb-6">
            {loading ? (
              <ProductDetailsSkeleton />
            ) : product ? (
              <ProductDetails
                product={product}
                onStatusChange={handleStatusChange}
                onToggleFeatured={handleToggleFeatured}
                onDelete={handleDelete}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
