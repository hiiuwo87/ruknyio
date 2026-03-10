/**
 * @rukny/database
 *
 * Centralized database client for the Rukny.io monorepo.
 * This package provides a shared Prisma client instance that can be
 * used across all applications in the workspace.
 *
 * @example
 * ```typescript
 * import { prisma, PrismaClient } from '@rukny/database';
 *
 * // Use the shared instance
 * const users = await prisma.user.findMany();
 *
 * // Or create your own instance
 * const client = new PrismaClient();
 * ```
 */

// Re-export Prisma client and types
export { PrismaClient, Prisma } from '@prisma/client';
export type * from '@prisma/client';

// Import PrismaClient for singleton creation
import { PrismaClient } from '@prisma/client';

/**
 * Global singleton PrismaClient instance
 * Prevents multiple instances during development hot-reloading
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Shared Prisma client instance
 * Use this for all database operations across the monorepo
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Create a new PrismaClient with custom options
 * Use this when you need a separate connection pool
 */
export function createPrismaClient(options?: ConstructorParameters<typeof PrismaClient>[0]) {
  return new PrismaClient(options);
}

/**
 * Disconnect the shared Prisma client
 * Call this during application shutdown
 */
export async function disconnectPrisma() {
  await prisma.$disconnect();
}
