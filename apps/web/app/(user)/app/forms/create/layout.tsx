import type { ReactNode } from 'react';

/**
 * Full-screen layout for form creation — no sidebar, no dashboard nav.
 * Overrides the parent (dashboard) layout's children slot so only
 * the wizard is rendered.
 */
export default function CreateFormLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-background overflow-hidden">
      {children}
    </div>
  );
}
