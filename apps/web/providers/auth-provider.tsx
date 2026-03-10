'use client';

/**
 * 🔐 Auth Provider - React Context for Authentication
 * 
 * Provides:
 * - User state management
 * - QuickSign (Magic Link) authentication
 * - OAuth authentication
 * - Auto token refresh
 * - Session persistence
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  User,
  AuthResponse,
  logout as apiLogout,
  getCurrentUser,
  refreshToken,
  requestQuickSign,
  verifyQuickSign,
  exchangeOAuthCode,
  completeProfile,
  updateOAuthProfile,
  type CompleteProfileInput,
  type QuickSignResponse,
} from '@/lib/api';
import { ApiException, clearCsrfToken, setCsrfToken, getCsrfToken, updateLastRefreshTime, setLoggingOut, resetRefreshState } from '@/lib/api/client';
import { getAuthUrl } from '@/lib/url';

// ============ Types ============

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsProfileCompletion: boolean;
  isRateLimited: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  // QuickSign methods
  sendMagicLink: (email: string) => Promise<QuickSignResponse>;
  verifyMagicLink: (token: string) => Promise<AuthResponse>;
  
  // OAuth methods
  handleOAuthCallback: (code: string) => Promise<AuthResponse>;
  
  // Profile completion
  completeUserProfile: (input: CompleteProfileInput) => Promise<void>;
  completeOAuthProfile: (input: Omit<CompleteProfileInput, 'quickSignToken'> & { phone?: string }) => Promise<any>;
  
  // Session management
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;

  /** True when /auth/me returned 429 – auth state is unknown, callers should NOT redirect */
  isRateLimited: boolean;
}

// ============ Context ============

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============ Provider ============

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    needsProfileCompletion: false,
    isRateLimited: false,
    error: null,
  });

  // Retry counter for rate-limited auth checks
  const rateLimitRetryRef = useRef(0);
  const MAX_RATE_LIMIT_RETRIES = 3;

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      // 🔒 Skip init if we're on OAuth callback page (will be handled by callback component)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        if (url.pathname.includes('/auth/callback') && url.searchParams.has('code')) {
          setState(prev => ({ ...prev, isLoading: false }));
          return;
        }
      }
      
      try {
        // 🔒 Check if we have a CSRF token (indicates logged-in state)
        // Access token is in httpOnly cookie (not accessible from JS)
        const csrfToken = getCsrfToken();

        if (!csrfToken) {
          // Try to refresh token from cookie
          try {
            const refreshResult = await refreshToken();
            // 🔒 If refresh returned user data, use it directly (skip /auth/me)
            if (refreshResult.user) {
              setState({
                user: refreshResult.user,
                isLoading: false,
                isAuthenticated: true,
                needsProfileCompletion: !refreshResult.user.name || !refreshResult.user.username,
                isRateLimited: false,
                error: null,
              });
              return;
            }
          } catch (err) {
            // No valid session - clear any stale tokens
            clearCsrfToken();
            setState(prev => ({ ...prev, isLoading: false }));
            // 🔒 Redirect to login if on a protected route with no valid session
            if (typeof window !== 'undefined') {
              const path = window.location.pathname;
              if (path === '/app' || path.startsWith('/app/')) {
                window.location.href = '/login?session=expired';
              }
            }
            return;
          }
        }

        // Get current user (only if refresh didn't return user data)
        const user = await getCurrentUser();
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
          needsProfileCompletion: !user.name || !user.username,
          isRateLimited: false,
          error: null,
        });
      } catch (err) {
        // 🔒 Handle 429 (Rate Limited) - DON'T clear auth state, retry with backoff
        if (err instanceof ApiException && err.isRateLimited) {
          const retryCount = rateLimitRetryRef.current;
          if (retryCount < MAX_RATE_LIMIT_RETRIES) {
            rateLimitRetryRef.current = retryCount + 1;
            const delayMs = Math.min(5000 * Math.pow(2, retryCount), 30_000);
            setState(prev => ({
              ...prev,
              isLoading: false,
              isRateLimited: true,
              // Keep previous auth state if we had one
              error: null,
            }));
            // Retry after delay
            setTimeout(() => initAuth(), delayMs);
            return;
          }
          // Exhausted retries - keep rate limited state, DON'T redirect
          setState(prev => ({
            ...prev,
            isLoading: false,
            isRateLimited: true,
            error: null,
          }));
          return;
        }

        // Clear CSRF token
        // Don't log error if it's just "Unauthorized" - this is expected when no user is logged in
        clearCsrfToken();
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          needsProfileCompletion: false,
          isRateLimited: false,
          error: null,
        });
      }
    };

    initAuth();
  }, []);

  // 🔒 Note: Proactive token refresh is handled by scheduleSilentRefresh() in client.ts
  // It automatically schedules refresh at 50% of token expiry time
  // No need for manual setInterval here - it would cause duplicate refresh attempts

  // Send magic link (QuickSign)
  const sendMagicLink = useCallback(async (email: string): Promise<QuickSignResponse> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await requestQuickSign(email);
      setState(prev => ({ ...prev, isLoading: false }));
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send magic link';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      throw err;
    }
  }, []);

  // Verify magic link token
  const verifyMagicLink = useCallback(async (token: string): Promise<AuthResponse> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await verifyQuickSign(token);
      
      // 🔒 Store CSRF token and update refresh time
      if (response.csrf_token) {
        setCsrfToken(response.csrf_token);
        updateLastRefreshTime();
      }
      
      if (response.user) {
        setState({
          user: response.user,
          isLoading: false,
          isAuthenticated: true,
          needsProfileCompletion: response.needsProfileCompletion || false,
          isRateLimited: false,
          error: null,
        });
      } else {
        // 🔒 Access token is in httpOnly cookie, fetch user
        const user = await getCurrentUser();
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
          needsProfileCompletion: response.needsProfileCompletion || !user.name || !user.username,
          isRateLimited: false,
          error: null,
        });
      }
      
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to verify magic link';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      throw err;
    }
  }, []);

  // Handle OAuth callback
  const handleOAuthCallback = useCallback(async (code: string): Promise<AuthResponse> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await exchangeOAuthCode(code);
      
      // 🔒 Store CSRF token and update refresh time
      if (response.csrf_token) {
        // Setting CSRF token from response
        setCsrfToken(response.csrf_token);
        updateLastRefreshTime();
      } else {
        // No CSRF token in response
      }
      
      if (response.user) {
        // Setting user from response
        setState({
          user: response.user,
          isLoading: false,
          isAuthenticated: true,
          needsProfileCompletion: response.needsProfileCompletion || false,
          isRateLimited: false,
          error: null,
        });
      } else {
        // 🔒 Access token is in httpOnly cookie, fetch user
        const user = await getCurrentUser();
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
          needsProfileCompletion: response.needsProfileCompletion || !user.name || !user.username,
          isRateLimited: false,
          error: null,
        });
      }
      
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth authentication failed';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      throw err;
    }
  }, []);

  // Complete user profile
  const completeUserProfile = useCallback(async (input: CompleteProfileInput) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await completeProfile(input);
      
      // 🔒 Update refresh time on successful profile completion
      updateLastRefreshTime();
      
      if (response.user) {
        setState(prev => ({
          ...prev,
          user: response.user,
          isLoading: false,
          needsProfileCompletion: false,
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete profile';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      throw err;
    }
  }, []);

  // Complete OAuth user profile (for Google/LinkedIn users)
  const completeOAuthProfile = useCallback(async (input: Omit<CompleteProfileInput, 'quickSignToken'> & { phone?: string }) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await updateOAuthProfile(input);
      
      // 🔒 Update refresh time on successful profile completion
      updateLastRefreshTime();
      
      if (response.user) {
        setState(prev => ({
          ...prev,
          user: response.user,
          isLoading: false,
          needsProfileCompletion: false,
        }));
      }
      
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete profile';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      throw err;
    }
  }, []);

  // Logout handler
  const logout = useCallback(async () => {
    // 🚪 Set logging out flag to prevent refresh attempts
    setLoggingOut(true);
    
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Call logout API
      await apiLogout();
    } catch (error) {
      // Ignore logout API errors - still clear local state
      console.warn('Logout API error:', error);
    } finally {
      clearCsrfToken();
      resetRefreshState();

      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        needsProfileCompletion: false,
        isRateLimited: false,
        error: null,
      });

      if (typeof window !== 'undefined') {
        window.location.replace(getAuthUrl('/login'));
      }
    }
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!state.isAuthenticated) return;

    try {
      const user = await getCurrentUser();
      setState(prev => ({ 
        ...prev, 
        user,
        needsProfileCompletion: !user.name || !user.username,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh user';
      setState(prev => ({ ...prev, error: message }));
    }
  }, [state.isAuthenticated]);

  // Set user directly (for external auth flows)
  const setUser = useCallback((user: User) => {
    setState(prev => ({
      ...prev,
      user,
      isAuthenticated: true,
      needsProfileCompletion: !user.name || !user.username,
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Memoize context value
  const value = useMemo<AuthContextType>(
    () => ({
      ...state,
      sendMagicLink,
      verifyMagicLink,
      handleOAuthCallback,
      completeUserProfile,
      completeOAuthProfile,
      logout,
      refreshUser,
      setUser,
      clearError,
    }),
    [state, sendMagicLink, verifyMagicLink, handleOAuthCallback, completeUserProfile, completeOAuthProfile, logout, refreshUser, setUser, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============ Hook ============

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

// ============ Utility Hooks ============

/**
 * Hook that returns only the user object
 */
export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

/**
 * Hook that returns authentication status
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}
