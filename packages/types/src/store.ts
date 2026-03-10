/**
 * Store Types
 * 
 * Shared store/e-commerce types for frontend and backend.
 */

import type { UserBase } from './user';

/**
 * Store type
 */
export interface Store {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  coverImage?: string | null;
  owner: UserBase;
  ownerId: string;
  isVerified: boolean;
  isActive: boolean;
  rating?: number;
  reviewCount: number;
  productCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  settings?: StoreSettings;
}

/**
 * Store settings
 */
export interface StoreSettings {
  currency?: string;
  taxRate?: number;
  shippingEnabled?: boolean;
  pickupEnabled?: boolean;
  minimumOrderAmount?: number;
  acceptedPaymentMethods?: string[];
}

/**
 * Product type
 */
export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  images: string[];
  price: number;
  compareAtPrice?: number | null;
  currency: string;
  sku?: string | null;
  barcode?: string | null;
  quantity: number;
  isInStock: boolean;
  isActive: boolean;
  storeId: string;
  store?: Store;
  category?: ProductCategory | null;
  categoryId?: string | null;
  variants?: ProductVariant[];
  attributes?: ProductAttribute[];
  rating?: number;
  reviewCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Product category
 */
export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  parentId?: string | null;
  children?: ProductCategory[];
}

/**
 * Product variant
 */
export interface ProductVariant {
  id: string;
  name: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  options: VariantOption[];
  image?: string;
}

/**
 * Variant option
 */
export interface VariantOption {
  name: string;
  value: string;
}

/**
 * Product attribute
 */
export interface ProductAttribute {
  id: string;
  name: string;
  value: string;
  type: AttributeType;
}

/**
 * Attribute type
 */
export type AttributeType = 'TEXT' | 'NUMBER' | 'COLOR' | 'SELECT' | 'BOOLEAN';

/**
 * Cart item
 */
export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  variantId?: string;
  variant?: ProductVariant;
  quantity: number;
  price: number;
  total: number;
}

/**
 * Shopping cart
 */
export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  couponCode?: string;
}

/**
 * Order status
 */
export type OrderStatus = 
  | 'PENDING'
  | 'PROCESSING'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

/**
 * Payment status
 */
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

/**
 * Order
 */
export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  storeId: string;
  store?: Store;
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Order item
 */
export interface OrderItem {
  id: string;
  productId: string;
  product?: Product;
  variantId?: string;
  variant?: ProductVariant;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  total: number;
}

/**
 * Address
 */
export interface Address {
  id?: string;
  fullName: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  isDefault?: boolean;
}

/**
 * Product review
 */
export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  user?: UserBase;
  rating: number;
  title?: string;
  content?: string;
  images?: string[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: Date | string;
}

/**
 * Coupon
 */
export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usedCount: number;
  startsAt?: Date | string;
  expiresAt?: Date | string;
  isActive: boolean;
}

/**
 * Coupon type
 */
export type CouponType = 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';
