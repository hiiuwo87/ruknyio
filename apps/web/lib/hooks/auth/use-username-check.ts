/**
 * 🔤 Username Check Hook
 * 
 * Debounced username availability check
 */

import { useState, useEffect, useRef } from 'react';
import { checkUsername } from '@/lib/api/auth';

interface UsernameCheckResult {
  available: boolean | null;
  checking: boolean;
  error: string | null;
  suggestions?: string[];
}

/**
 * Hook to check username availability with debouncing
 * 
 * @param username - The username to check
 * @param debounceMs - Debounce delay in milliseconds (default: 500)
 * @returns Object with availability status, loading state, and error
 */
export function useUsernameCheck(username: string, debounceMs = 500): UsernameCheckResult {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | undefined>();
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset state if username is empty or too short
    if (!username || username.length < 3) {
      setAvailable(null);
      setChecking(false);
      setError(null);
      setSuggestions(undefined);
      return;
    }

    // Validate username format
    if (!/^[a-z0-9_]+$/.test(username)) {
      setAvailable(false);
      setChecking(false);
      setError('اسم المستخدم يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطة سفلية فقط');
      setSuggestions(undefined);
      return;
    }

    if (username.length > 30) {
      setAvailable(false);
      setChecking(false);
      setError('اسم المستخدم يجب أن يكون 30 حرف أو أقل');
      setSuggestions(undefined);
      return;
    }

    setChecking(true);
    setError(null);

    // Debounce the API call
    timeoutRef.current = setTimeout(async () => {
      abortControllerRef.current = new AbortController();

      try {
        const result = await checkUsername(username);
        
        // Check if request was aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        setAvailable(result.available);
        setSuggestions(result.suggestions);
        setError(result.available ? null : 'اسم المستخدم غير متاح');
      } catch (err) {
        // Ignore aborted requests
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        
        // Username check error
        setAvailable(null);
        setError('خطأ في التحقق من اسم المستخدم');
      } finally {
        setChecking(false);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [username, debounceMs]);

  return { available, checking, error, suggestions };
}
