'use client';

import { useEffect, useState, useCallback } from 'react';

export interface UsePushNotificationsResult {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  getPublicKey: () => string | null;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

  // Register Service Worker and check subscription status
  useEffect(() => {
    if (!isSupported) {
      setIsLoading(false);
      return;
    }

    const initializePushNotifications = async () => {
      try {
        // Register service worker
        const reg = await navigator.serviceWorker.register('/service-worker.js', {
          scope: '/',
        });

        setRegistration(reg);

        // Check current subscription status
        const subscription = await reg.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (err) {
        console.error('Failed to register service worker:', err);
        setError('فشل تسجيل خدمة متصفحك');
      } finally {
        setIsLoading(false);
      }
    };

    initializePushNotifications();
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !registration || !publicKey) {
      setError('متصفحك لا يدعم الإشعارات');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Request notification permission if not granted
      if (Notification.permission === 'denied') {
        throw new Error('تم رفض الإذن - غير صفحة الإعدادات لتفعيل الإشعارات');
      }

      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          throw new Error('تم رفض الإذن بإظهار الإشعارات');
        }
      }

      // Convert VAPID key from base64 to Uint8Array
      const vapidKey = urlBase64ToUint8Array(publicKey);

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey as BufferSource,
      });

      // Send subscription to backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/push-subscriptions/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            auth: arrayBufferToBase64(subscription.getKey('auth')),
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
          },
        }),
      });

      if (!response.ok) {
        throw new Error('فشل تسجيل الاشتراك في الخادم');
      }

      setIsSubscribed(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      setError(errorMessage);
      console.error('Push subscription error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, registration, publicKey]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !registration) {
      setError('متصفحك لا يدعم الإشعارات');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      // Send unsubscribe request to backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/push-subscriptions/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      });

      if (!response.ok) {
        throw new Error('فشل إلغاء الاشتراك');
      }

      // Unsubscribe from push manager
      await subscription.unsubscribe();
      setIsSubscribed(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      setError(errorMessage);
      console.error('Push unsubscription error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, registration]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    getPublicKey: () => publicKey,
  };
}

// Helper functions
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return window.btoa(binary);
}
