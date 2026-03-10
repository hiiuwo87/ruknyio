/**
 * Force this segment to be dynamic (no static prerender).
 * Fixes Next.js InvariantError: workUnitAsyncStorage during build.
 */
export const dynamic = 'force-dynamic';

export default function AuthCallbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
