/**
 * ⚡ Pagination Utilities
 *
 * Provides reusable pagination helpers for API endpoints
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

export interface CursorPaginatedResult<T> {
  data: T[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
}

/**
 * Calculate offset for traditional pagination
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Build paginated response with metadata
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

/**
 * Build cursor-based paginated response
 * More efficient for large datasets
 */
export function buildCursorPaginatedResponse<T extends { id: string }>(
  data: T[],
  limit: number,
): CursorPaginatedResult<T> {
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;
  const nextCursor =
    hasMore && items.length > 0 ? items[items.length - 1].id : undefined;

  return {
    data: items,
    pagination: {
      limit,
      hasMore,
      nextCursor,
    },
  };
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Validate and normalize pagination params
 */
export function normalizePaginationParams(params: PaginationParams): {
  page: number;
  limit: number;
  cursor?: string;
} {
  const page = Math.max(1, params.page || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit || DEFAULT_LIMIT));

  return {
    page,
    limit,
    cursor: params.cursor,
  };
}
