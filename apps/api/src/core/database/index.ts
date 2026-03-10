/**
 * ⚡ Database Module Exports
 * Centralized database utilities for the API
 */

// Core services
export { PrismaService } from './prisma/prisma.service';
export { DatabaseCleanupService } from './cleanup.service';

// Constants
export {
  DB_POOL,
  DB_CLEANUP,
  DB_PERFORMANCE,
  QUERY_TIMEOUTS,
  buildDatabaseUrl,
} from './database.constants';

// Query helpers
export {
  // Select patterns
  USER_SELECT_MINIMAL,
  USER_SELECT_WITH_PROFILE,
  USER_SELECT_AUTH,
  PROFILE_SELECT_PUBLIC,
  STORE_SELECT_MINIMAL,
  STORE_SELECT_WITH_CATEGORY,
  PRODUCT_SELECT_LIST,
  EVENT_SELECT_LIST,
  FORM_SELECT_LIST,
  // Pagination
  PaginationParams,
  PaginationResult,
  buildOffsetPagination,
  buildCursorPagination,
  processCursorResults,
  // Query builders
  createSelect,
  mergeSelect,
  buildSearchWhere,
  buildDateRangeWhere,
  combineWhere,
  buildOrderBy,
  SORT_OPTIONS,
} from './query.helpers';
