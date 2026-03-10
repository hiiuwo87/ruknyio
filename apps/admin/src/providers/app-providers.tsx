"use client";

import { type ReactNode } from "react";
import { AdminAuthProvider } from "./auth-provider";
import { QueryProvider } from "./query-provider";
import { Toaster } from "sonner";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AdminAuthProvider>
        {children}
        <Toaster position="top-right" richColors />
      </AdminAuthProvider>
    </QueryProvider>
  );
}
