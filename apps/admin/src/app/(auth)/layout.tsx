/**
 * Force all (auth) routes to be dynamic (no static prerender).
 */
export const dynamic = "force-dynamic";

export default function AuthGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
