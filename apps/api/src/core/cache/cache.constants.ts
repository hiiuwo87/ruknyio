/**
 * ⚡ Cache Constants - Centralized cache configuration
 * All cache keys and TTLs in one place for easy management
 */

// ===== TTL Constants (in seconds) =====
export const CACHE_TTL = {
  // Short-lived (30 seconds - 2 minutes)
  SHORT: 30, // For rapidly changing data
  DASHBOARD: 120, // Dashboard stats - 2 minutes
  LIST: 60, // Listings with pagination

  // Medium-lived (5-15 minutes)
  MEDIUM: 300, // 5 minutes - Default for most queries
  PROFILE: 300, // User profiles - 5 minutes
  STORE: 300, // Store details - 5 minutes
  FORM: 300, // Form details - 5 minutes
  EVENT: 300, // Event details - 5 minutes

  // Long-lived (30 minutes - 1 hour)
  LONG: 1800, // 30 minutes
  CATEGORIES: 3600, // Categories rarely change - 1 hour
  STATIC: 3600, // Static content - 1 hour

  // Very long (1-24 hours)
  METADATA: 86400, // Metadata - 24 hours
} as const;

// ===== Cache Key Prefixes =====
export const CACHE_PREFIX = {
  // User & Auth
  USER: 'user',
  PROFILE: 'profile',
  SESSION: 'session',
  DASHBOARD: 'dashboard',

  // Content
  FORM: 'form',
  EVENT: 'event',
  STORE: 'store',
  PRODUCT: 'product',

  // Lists
  LIST: 'list',
  PUBLIC: 'public',

  // Categories & Metadata
  CATEGORY: 'category',
  METADATA: 'meta',
} as const;

// ===== Cache Key Builders =====
export const CacheKeys = {
  // Dashboard
  dashboardStats: (userId: string) => `${CACHE_PREFIX.DASHBOARD}:stats:${userId}`,
  dashboardActivity: (userId: string) => `${CACHE_PREFIX.DASHBOARD}:activity:${userId}`,

  // Profile
  profileByUsername: (username: string) => `${CACHE_PREFIX.PROFILE}:username:${username}`,
  profileByUserId: (userId: string) => `${CACHE_PREFIX.PROFILE}:user:${userId}`,

  // Store
  storeByUserId: (userId: string) => `${CACHE_PREFIX.STORE}:user:${userId}`,
  storeBySlug: (slug: string) => `${CACHE_PREFIX.STORE}:slug:${slug}`,
  storeById: (id: string) => `${CACHE_PREFIX.STORE}:id:${id}`,
  storeCategories: () => `${CACHE_PREFIX.STORE}:categories`,
  storeProducts: (storeId: string, filters?: string) =>
    `${CACHE_PREFIX.STORE}:${storeId}:products${filters ? `:${filters}` : ''}`,

  // Products
  productById: (id: string) => `${CACHE_PREFIX.PRODUCT}:id:${id}`,
  productBySlug: (slug: string) => `${CACHE_PREFIX.PRODUCT}:slug:${slug}`,
  productsByStore: (storeId: string) => `${CACHE_PREFIX.PRODUCT}:store:${storeId}`,
  myProducts: (userId: string, filters?: string) =>
    `${CACHE_PREFIX.PRODUCT}:my:${userId}${filters ? `:${filters}` : ''}`,

  // Events
  eventById: (id: string) => `${CACHE_PREFIX.EVENT}:id:${id}`,
  eventBySlug: (slug: string) => `${CACHE_PREFIX.EVENT}:slug:${slug}`,
  eventsList: (filters?: string) =>
    `${CACHE_PREFIX.EVENT}:${CACHE_PREFIX.LIST}${filters ? `:${filters}` : ''}`,
  myEvents: (userId: string) => `${CACHE_PREFIX.EVENT}:my:${userId}`,
  eventCategories: () => `${CACHE_PREFIX.EVENT}:categories`,

  // Forms
  formById: (id: string) => `${CACHE_PREFIX.FORM}:id:${id}`,
  formBySlug: (slug: string) => `${CACHE_PREFIX.FORM}:slug:${slug}`,
  formsList: (userId: string, filters?: string) =>
    `${CACHE_PREFIX.FORM}:${CACHE_PREFIX.LIST}:${userId}${filters ? `:${filters}` : ''}`,
  publicFormsByUsername: (username: string) =>
    `${CACHE_PREFIX.FORM}:${CACHE_PREFIX.PUBLIC}:${username}`,

  // Notifications
  notificationsList: (userId: string) => `notifications:list:${userId}`,
  notificationsUnreadCount: (userId: string) => `notifications:unread:${userId}`,

  // Generic pattern matcher for invalidation
  pattern: {
    userAll: (userId: string) => `*:*:${userId}*`,
    storeAll: (storeId: string) => `${CACHE_PREFIX.STORE}:*:${storeId}*`,
    productAll: (productId: string) => `${CACHE_PREFIX.PRODUCT}:*:${productId}*`,
    eventAll: (eventId: string) => `${CACHE_PREFIX.EVENT}:*:${eventId}*`,
    formAll: (formId: string) => `${CACHE_PREFIX.FORM}:*:${formId}*`,
  },
} as const;

// ===== Cache Tags for grouped invalidation =====
export const CACHE_TAGS = {
  USER: 'tag:user',
  STORE: 'tag:store',
  PRODUCT: 'tag:product',
  EVENT: 'tag:event',
  FORM: 'tag:form',
  CATEGORY: 'tag:category',
  NOTIFICATION: 'tag:notification',
} as const;
