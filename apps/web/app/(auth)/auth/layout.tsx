/**
 * Force all /auth/* routes to be dynamic (no static prerender).
 * Fixes Next.js InvariantError: workUnitAsyncStorage during build.
 */
export const dynamic = 'force-dynamic';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
