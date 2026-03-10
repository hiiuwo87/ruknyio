/**
 * API Response Types
 * 
 * Standard response formats for API endpoints.
 * Used across both backend (NestJS) and frontend (Next.js).
 */

/**
 * Standard API success response
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Cursor-based pagination response
 */
export interface CursorPaginatedResponse<T> {
  data: T[];
  meta: CursorPaginationMeta;
}

/**
 * Cursor pagination metadata
 */
export interface CursorPaginationMeta {
  cursor: string | null;
  hasMore: boolean;
  total?: number;
}

/**
 * Query parameters for pagination
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  limit?: number;
}

/**
 * Query parameters for cursor pagination
 */
export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
}

/**
 * Query parameters for sorting
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Combined query parameters
 */
export interface QueryParams extends PaginationParams, SortParams {
  search?: string;
  filter?: Record<string, unknown>;
}
