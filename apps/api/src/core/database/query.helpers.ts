/**
 * ⚡ Query Helpers - Optimized query patterns for Prisma
 *
 * These helpers ensure consistent, performant queries across the application.
 */

import { DB_PERFORMANCE } from './database.constants';

// ===== Common Select Patterns =====

/**
 * ⚡ Minimal user select - only essential fields
 * Use when you just need user identity
 */
export const USER_SELECT_MINIMAL = {
  id: true,
  email: true,
} as const;

/**
 * ⚡ User with profile - common pattern for displaying user info
 */
export const USER_SELECT_WITH_PROFILE = {
  id: true,
  email: true,
  profile: {
    select: {
      name: true,
      username: true,
      avatar: true,
    },
  },
} as const;

/**
 * ⚡ User for auth context - fields needed for JWT/session
 */
export const USER_SELECT_AUTH = {
  id: true,
  email: true,
  role: true,
  emailVerified: true,
  twoFactorEnabled: true,
} as const;

/**
 * ⚡ Profile select - public profile info
 */
export const PROFILE_SELECT_PUBLIC = {
  id: true,
  username: true,
  name: true,
  bio: true,
  avatar: true,
  coverImage: true,
  visibility: true,
} as const;

/**
 * ⚡ Store select - minimal store info
 */
export const STORE_SELECT_MINIMAL = {
  id: true,
  name: true,
  slug: true,
  logo: true,
  status: true,
} as const;

/**
 * ⚡ Store select - with category
 */
export const STORE_SELECT_WITH_CATEGORY = {
  ...STORE_SELECT_MINIMAL,
  store_categories: {
    select: {
      id: true,
      name: true,
      nameAr: true,
    },
  },
} as const;

/**
 * ⚡ Product select - for listings
 */
export const PRODUCT_SELECT_LIST = {
  id: true,
  name: true,
  nameAr: true,
  slug: true,
  price: true,
  salePrice: true,
  currency: true,
  status: true,
  isFeatured: true,
  product_images: {
    select: {
      imagePath: true,
      isPrimary: true,
    },
    take: 1,
    orderBy: { isPrimary: 'desc' as const },
  },
} as const;

/**
 * ⚡ Event select - for listings
 */
export const EVENT_SELECT_LIST = {
  id: true,
  title: true,
  slug: true,
  description: true,
  startDate: true,
  endDate: true,
  location: true,
  imageUrl: true,
  status: true,
  isFeatured: true,
  isVirtual: true,
  _count: {
    select: {
      registrations: true,
    },
  },
} as const;

/**
 * ⚡ Form select - for listings
 */
export const FORM_SELECT_LIST = {
  id: true,
  title: true,
  slug: true,
  description: true,
  type: true,
  status: true,
  coverImage: true,
  createdAt: true,
  closesAt: true,
  _count: {
    select: {
      submissions: true,
    },
  },
} as const;

// ===== Pagination Helpers =====

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    total?: number;
    page?: number;
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

/**
 * ⚡ Build offset pagination parameters
 */
export function buildOffsetPagination(params: PaginationParams): {
  skip: number;
  take: number;
} {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(
    params.limit || DB_PERFORMANCE.DEFAULT_PAGE_SIZE,
    DB_PERFORMANCE.MAX_PAGE_SIZE,
  );

  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * ⚡ Build cursor pagination parameters
 * More efficient for large datasets
 */
export function buildCursorPagination(params: PaginationParams): {
  take: number;
  skip?: number;
  cursor?: { id: string };
} {
  const limit = Math.min(
    params.limit || DB_PERFORMANCE.DEFAULT_PAGE_SIZE,
    DB_PERFORMANCE.MAX_PAGE_SIZE,
  );

  if (params.cursor) {
    return {
      take: limit + 1, // Fetch one extra to check if more exist
      skip: 1, // Skip the cursor item
      cursor: { id: params.cursor },
    };
  }

  return {
    take: limit + 1,
  };
}

/**
 * ⚡ Process cursor pagination results
 */
export function processCursorResults<T extends { id: string }>(
  items: T[],
  limit: number,
): { data: T[]; hasMore: boolean; nextCursor?: string } {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : undefined;

  return { data, hasMore, nextCursor };
}

// ===== Query Optimization Helpers =====

/**
 * ⚡ Create a select object from an array of field names
 */
export function createSelect<T extends string>(fields: T[]): Record<T, true> {
  return fields.reduce(
    (acc, field) => {
      acc[field] = true;
      return acc;
    },
    {} as Record<T, true>,
  );
}

/**
 * ⚡ Merge multiple select objects
 */
export function mergeSelect(...selects: Record<string, any>[]): Record<string, any> {
  return Object.assign({}, ...selects);
}

/**
 * ⚡ Build a where clause for search across multiple fields
 */
export function buildSearchWhere(
  searchTerm: string | undefined,
  fields: string[],
): any {
  if (!searchTerm || searchTerm.trim() === '') {
    return undefined;
  }

  return {
    OR: fields.map((field) => ({
      [field]: { contains: searchTerm, mode: 'insensitive' },
    })),
  };
}

/**
 * ⚡ Build date range filter
 */
export function buildDateRangeWhere(
  field: string,
  startDate?: Date,
  endDate?: Date,
): any {
  if (!startDate && !endDate) return undefined;

  const where: any = {};

  if (startDate) {
    where.gte = startDate;
  }

  if (endDate) {
    where.lte = endDate;
  }

  return { [field]: where };
}

/**
 * ⚡ Combine multiple where conditions with AND
 */
export function combineWhere(...conditions: (any | undefined)[]): any {
  const validConditions = conditions.filter(Boolean);

  if (validConditions.length === 0) return undefined;
  if (validConditions.length === 1) return validConditions[0];

  return { AND: validConditions };
}

// ===== Type-safe Order By Helpers =====

export type SortDirection = 'asc' | 'desc';

export function buildOrderBy<T extends string>(
  field: T,
  direction: SortDirection = 'desc',
): { [K in T]: SortDirection } {
  return { [field]: direction } as { [K in T]: SortDirection };
}

/**
 * ⚡ Common sort options
 */
export const SORT_OPTIONS = {
  NEWEST: { createdAt: 'desc' as const },
  OLDEST: { createdAt: 'asc' as const },
  UPDATED: { updatedAt: 'desc' as const },
  NAME_ASC: { name: 'asc' as const },
  NAME_DESC: { name: 'desc' as const },
  PRICE_LOW: { price: 'asc' as const },
  PRICE_HIGH: { price: 'desc' as const },
} as const;
