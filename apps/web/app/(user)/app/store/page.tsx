'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Package, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import {
  StoreStats,
  StoreStatsSkeleton,
  StoreFiltersBar,
  ProductCard,
  ProductsGridSkeleton,
  EmptyStoreState,
} from '@/components/(app)/store';
import {
  useStore,
  Product,
  ProductsFilters,
  StoreStats as StatsType,
  ProductsSortOption,
  filterProducts,
  sortProducts,
  calculateStoreStats,
} from '@/lib/hooks/useStore';
import { useRouter } from 'next/navigation';
import { toast, toastMessages } from '@/components/toast-provider';

export default function StorePage() {
  const router = useRouter();
  const {
    getProducts,
    deleteProduct,
    toggleProductStatus,
    isLoading,
    error: hookError,
  } = useStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [filters, setFilters] = useState<ProductsFilters>({});
  const [sortBy, setSortBy] = useState<ProductsSortOption>('newest');

  const loadProducts = useCallback(async () => {
    const data = await getProducts();
    setProducts(data);
  }, [getProducts]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const stats: StatsType = useMemo(() => {
    return calculateStoreStats(products);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const filtered = filterProducts(products, filters);
    return sortProducts(filtered, sortBy);
  }, [products, filters, sortBy]);

  const handleCreateProduct = useCallback(() => {
    router.push('/app/store/products/new');
  }, [router]);

  const handleEditProduct = useCallback((product: Product) => {
    router.push(`/app/store/products/${product.id}/edit`);
  }, [router]);

  const handleViewProduct = useCallback((product: Product) => {
    router.push(`/app/store/products/${product.id}`);
  }, [router]);

  const handleDeleteProduct = useCallback(async (product: Product) => {
    const success = await deleteProduct(product.id);
    if (success) {
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toastMessages.deleteSuccess('المنتج');
    } else {
      toast.error('فشل حذف المنتج. يرجى المحاولة مرة أخرى');
    }
  }, [deleteProduct]);

  const handleToggleStatus = useCallback(async (product: Product) => {
    const newStatus = !product.isActive;
    const success = await toggleProductStatus(product.id, newStatus);
    if (success) {
      setProducts((prev) =>
        prev.map((p) => p.id === product.id ? { ...p, isActive: newStatus } : p)
      );
      toast.success(newStatus ? 'تم نشر المنتج' : 'تم إخفاء المنتج');
    } else {
      toast.error('فشل تحديث حالة المنتج');
    }
  }, [toggleProductStatus]);

  return (
    <div
      className="relative flex h-[calc(100%-1rem)] flex-1 min-w-0 gap-4 m-2 md:ms-0"
      dir="rtl"
    >
      {/* Main Content */}
      <div className="flex-1 min-w-0 bg-card overflow-hidden">
        <div className="h-full overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="p-4 sm:p-6 space-y-5">
            {/* Page Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">متجري</h1>
                  <p className="text-sm text-muted-foreground">
                    إدارة المنتجات والمبيعات
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadProducts}
                  disabled={isLoading}
                  aria-label="تحديث قائمة المنتجات"
                  className={`p-2 sm:p-2.5 rounded-xl bg-card text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none ${isLoading ? 'animate-spin' : ''}`}
                >
                  <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                <button
                  type="button"
                  onClick={handleCreateProduct}
                  aria-label="إضافة منتج جديد"
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة منتج</span>
                </button>
              </div>
            </div>

            {/* Error block */}
            {hookError && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{hookError}</span>
                </div>
                <button
                  type="button"
                  onClick={loadProducts}
                  disabled={isLoading}
                  className="shrink-0 rounded-lg px-3 py-1.5 font-medium bg-destructive/20 hover:bg-destructive/30 transition-colors disabled:opacity-50"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}

            {/* Stats */}
            {isLoading ? (
              <StoreStatsSkeleton />
            ) : (
              <StoreStats stats={stats} isLoading={isLoading} />
            )}

            {/* Filters */}
            {products.length > 0 && (
              <StoreFiltersBar
                filters={filters}
                onFiltersChange={setFilters}
                sortBy={sortBy}
                onSortChange={setSortBy}
                resultsCount={filteredProducts.length}
              />
            )}

            {/* Content */}
            {isLoading ? (
              <ProductsGridSkeleton count={6} />
            ) : products.length === 0 ? (
              <EmptyStoreState onCreateProduct={handleCreateProduct} />
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-3xl bg-muted/30 p-8 text-center">
                <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-foreground mb-1">
                  لا توجد نتائج
                </h3>
                <p className="text-sm text-muted-foreground">
                  جرب تغيير معايير البحث
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onEdit={handleEditProduct}
                    onDelete={handleDeleteProduct}
                    onView={handleViewProduct}
                    onToggleStatus={handleToggleStatus}
                  />
                ))}
              </div>
            )}

            {/* Bottom Blur Gradient Effect */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card via-card/80 to-transparent pointer-events-none z-10" />
          </div>
        </div>
      </div>
    </div>
  );
}
