/**
 * 🔒 Secure API Client for Admin Panel
 * - Handles API calls with proper headers
 * - Manages authentication tokens
 * - Handles CORS and credentials
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export interface ApiError {
  message: string;
  status: number;
  data?: unknown;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Make an API request with proper security headers
   */
  async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest', // Prevent CSRF
      ...options.headers,
    };

    const config: RequestInit = {
      ...options,
      headers: defaultHeaders,
      credentials: 'include', // 🔒 Include cookies (for httpOnly JWT)
    };

    try {
      const response = await fetch(url, config);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        throw {
          message: (data as any)?.message || 'API request failed',
          status: response.status,
          data,
        } as ApiError;
      }

      return data as T;
    } catch (error) {
      if (error instanceof Error && 'message' in error && 'status' in error) {
        throw error;
      }

      console.error(`API Error [${endpoint}]:`, error);
      throw {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 0,
      } as ApiError;
    }
  }

  /**
   * GET request
   */
  async get<T = unknown>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post<T = unknown>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * PUT request
   */
  async put<T = unknown>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(
    endpoint: string,
    data?: unknown,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }
}

// Export a default instance
export const apiClient = new ApiClient(API_BASE_URL);
