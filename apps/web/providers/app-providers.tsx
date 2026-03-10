'use client';

/**
 * 🎁 App Providers - Wraps all providers together
 */

import { type ReactNode } from 'react';
import { QueryProvider } from './query-provider';
import { AuthProvider } from './auth-provider';
import { PerformanceProvider } from './performance-provider';
import { ErrorBoundary } from '@/components/error-boundary';
import { ToastProvider } from '@/components/ui/toast';
import { SessionTimeoutWarning } from '@/components/session-timeout-warning';
import { NetworkStatusProvider } from '@/components/network-status';

interface AppProvidersProps {
  children: ReactNode;
}

// Only enable performance monitoring in production
const enablePerformance = process.env.NODE_ENV === 'production';

export function AppProviders({ children }: AppProvidersProps) {
  const content = (
    <ErrorBoundary>
      <QueryProvider>
        <AuthProvider>
          <ToastProvider>
            <NetworkStatusProvider>
              <SessionTimeoutWarning warningTime={60} />
              {children}
            </NetworkStatusProvider>
          </ToastProvider>
        </AuthProvider>
      </QueryProvider>
    </ErrorBoundary>
  );

  return enablePerformance ? (
    <PerformanceProvider>{content}</PerformanceProvider>
  ) : (
    content
  );
}
