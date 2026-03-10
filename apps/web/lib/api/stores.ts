/**
 * 🏪 Stores API - E-commerce store endpoints
 */

import { z } from 'zod';
import api from './client';

// ============ Schemas ============

export const StoreSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  logo: z.string().nullable(),
  banner: z.string().nullable(),
  isActive: z.boolean(),
  currency: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Store = z.infer<typeof StoreSchema>;

export const CreateStoreInputSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).optional(),
  description: z.string().max(500).optional(),
  currency: z.string().default('USD'),
});

export type CreateStoreInput = z.infer<typeof CreateStoreInputSchema>;

export const ProductSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  compareAtPrice: z.number().nullable(),
  images: z.array(z.string()),
  isActive: z.boolean(),
  stock: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Product = z.infer<typeof ProductSchema>;

// ============ API Functions ============

/**
 * Get user's stores
 */
export async function getMyStores(): Promise<Store[]> {
  const { data } = await api.get<Store[]>('/stores/my');
  // Runtime validation with Zod schema
  return z.array(StoreSchema).parse(data);
}

/**
 * Get store by slug
 */
export async function getStoreBySlug(slug: string): Promise<Store> {
  const { data } = await api.get<Store>(`/stores/${slug}`);
  // Runtime validation with Zod schema
  return StoreSchema.parse(data);
}

/**
 * Create a new store
 */
export async function createStore(input: CreateStoreInput): Promise<Store> {
  const validated = CreateStoreInputSchema.parse(input);
  const { data } = await api.post<Store>('/stores', validated);
  // Runtime validation with Zod schema
  return StoreSchema.parse(data);
}

/**
 * Get store products
 */
export async function getStoreProducts(storeId: string): Promise<Product[]> {
  const { data } = await api.get<Product[]>(`/stores/${storeId}/products`);
  // Runtime validation with Zod schema
  return z.array(ProductSchema).parse(data);
}
