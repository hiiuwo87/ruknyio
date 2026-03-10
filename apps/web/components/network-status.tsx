'use client';

/**
 * 🌐 Network Status Component
 * 
 * Shows a toast/banner when the user goes offline or comes back online
 */

import { useEffect, useRef } from 'react';
import { useNetwork } from '@/lib/hooks/use-network';
import { toast } from '@/components/toast-provider';
import { Wifi, WifiOff } from 'lucide-react';

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const { isOnline, isSlow, effectiveType } = useNetwork();
  const prevOnlineRef = useRef(isOnline);
  const prevSlowRef = useRef(isSlow);
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    // Online/Offline transitions
    if (prevOnlineRef.current !== isOnline) {
      // Dismiss any existing network toast
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }

      if (!isOnline) {
        // Went offline
        toastIdRef.current = toast.custom(
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <WifiOff className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                لا يوجد اتصال بالإنترنت
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                بعض الميزات قد لا تعمل بشكل صحيح
              </p>
            </div>
          </div>,
          { duration: Infinity } // Stay until online
        );
      } else {
        // Came back online
        toast.success('تم استعادة الاتصال بالإنترنت');
      }

      prevOnlineRef.current = isOnline;
    }

    // Slow connection warning
    if (prevSlowRef.current !== isSlow && isSlow && isOnline) {
      toast.warning(
        `اتصالك بطيء (${effectiveType}). قد يكون التحميل أبطأ من المعتاد.`,
        { duration: 5000 }
      );
      prevSlowRef.current = isSlow;
    } else if (!isSlow) {
      prevSlowRef.current = false;
    }
  }, [isOnline, isSlow, effectiveType]);

  return <>{children}</>;
}

/**
 * Standalone offline banner (alternative to toast)
 */
export function OfflineBanner() {
  const { isOnline } = useNetwork();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white py-2 px-4 text-center text-sm">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4" />
        <span>لا يوجد اتصال بالإنترنت</span>
      </div>
    </div>
  );
}

export default NetworkStatusProvider;
