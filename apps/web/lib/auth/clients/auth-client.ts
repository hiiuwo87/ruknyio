/**
 * Auth Client - Re-export auth utilities
 */

export * from '@/lib/api/auth';

// AuthClient class for backwards compatibility
export class AuthClient {
  static getToken(): string | null {
    // In httpOnly cookie setup, tokens are sent automatically
    // This is mainly for backwards compatibility
    if (typeof window === 'undefined') return null;
    
    // Try to get CSRF token from cookie
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    return match ? match[1] : null;
  }

  static async refreshTokens(): Promise<boolean> {
    try {
      const { refreshToken } = await import('@/lib/api/auth');
      await refreshToken();
      return true;
    } catch (error) {
      // Token refresh error
      return false;
    }
  }

  static async logout(): Promise<void> {
    try {
      const { logout } = await import('@/lib/api/auth');
      await logout();
    } catch (error) {
      // Logout error
    }
  }

  static async getCurrentUser() {
    try {
      const { getCurrentUser } = await import('@/lib/api/auth');
      return await getCurrentUser();
    } catch (error) {
      return null;
    }
  }
}

export default AuthClient;
