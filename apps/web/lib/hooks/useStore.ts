'use client';

import { useState, useCallback } from 'react';
import { AuthClient } from '@/lib/auth/auth-client';
import { API_URL } from '@/lib/config';

// ==================== ENUMS ====================

export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  DRAFT = 'DRAFT',
  ARCHIVED = 'ARCHIVED',
}

// ==================== INTERFACES ====================

export interface Product {
  id: string;
  storeId: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  isActive: boolean;
  stock: number;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface StoreStats {
  totalProducts: number;
  activeProducts: number;
  draftProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalViews: number;
}

export interface ProductsFilters {
  status?: 'active' | 'draft' | 'archived';
  search?: string;
  categoryId?: string;
}

export type ProductsSortOption = 'newest' | 'oldest' | 'name' | 'price-high' | 'price-low' | 'stock';

// ==================== ARABIC LABELS ====================

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  active: 'نشط',
  draft: 'مسودة',
  archived: 'مؤرشف',
};

export const PRODUCT_STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  active: { color: 'text-emerald-600', bg: 'bg-emerald-100' },
  draft: { color: 'text-gray-600', bg: 'bg-gray-100' },
  archived: { color: 'text-amber-600', bg: 'bg-amber-100' },
};

// ==================== HELPERS ====================

export function filterProducts(products: Product[], filters: ProductsFilters): Product[] {
  if (!products || !Array.isArray(products)) return [];

  return products.filter((product) => {
    if (filters.status) {
      if (filters.status === 'active' && !product.isActive) return false;
      if (filters.status === 'draft' && product.isActive) return false;
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesName = product.name.toLowerCase().includes(searchLower);
      const matchesDesc = product.description?.toLowerCase().includes(searchLower);
      const matchesSlug = product.slug.toLowerCase().includes(searchLower);
      if (!matchesName && !matchesDesc && !matchesSlug) return false;
    }

    if (filters.categoryId && product.categoryId !== filters.categoryId) return false;

    return true;
  });
}

export function sortProducts(products: Product[], sortBy: ProductsSortOption): Product[] {
  if (!products || !Array.isArray(products)) return [];

  const sorted = [...products];
  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    case 'price-high':
      return sorted.sort((a, b) => b.price - a.price);
    case 'price-low':
      return sorted.sort((a, b) => a.price - b.price);
    case 'stock':
      return sorted.sort((a, b) => b.stock - a.stock);
    default:
      return sorted;
  }
}

export function calculateStoreStats(products: Product[]): StoreStats {
  if (!products || !Array.isArray(products)) {
    return { totalProducts: 0, activeProducts: 0, draftProducts: 0, totalOrders: 0, totalRevenue: 0, totalViews: 0 };
  }

  return {
    totalProducts: products.length,
    activeProducts: products.filter(p => p.isActive).length,
    draftProducts: products.filter(p => !p.isActive).length,
    totalOrders: 0,
    totalRevenue: 0,
    totalViews: 0,
  };
}

// ==================== HOOK ====================

export function useStore() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let token = AuthClient.getToken();
    if (!token) {
      const refreshed = await AuthClient.refreshTokens();
      if (refreshed) {
        token = AuthClient.getToken();
      }
    }
    return token;
  }, []);

  const getAuthHeaders = useCallback(async () => {
    const token = await ensureAuth();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [ensureAuth]);

  // Get store products
  const getProducts = useCallback(async (): Promise<Product[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/stores/my-store/products`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('فشل في تحميل المنتجات');
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      setError(err.message || 'فشل في تحميل المنتجات');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeaders]);

  // Delete product
  const deleteProduct = useCallback(async (productId: string): Promise<boolean> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/products/${productId}`, {
        method: 'DELETE',
        headers,
      });
      return response.ok;
    } catch {
      return false;
    }
  }, [getAuthHeaders]);

  // Toggle product status
  const toggleProductStatus = useCallback(async (productId: string, isActive: boolean): Promise<boolean> => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/products/${productId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isActive }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }, [getAuthHeaders]);

  return {
    getProducts,
    deleteProduct,
    toggleProductStatus,
    isLoading,
    error,
  };
}
