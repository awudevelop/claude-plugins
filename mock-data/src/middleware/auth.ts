/**
 * Auth Middleware
 *
 * Handles authentication token injection and refresh.
 */

import { Middleware, MiddlewareContext } from './types';
import { AdapterError } from '../adapters/types';

export interface AuthMiddlewareConfig {
  /** Function to get the current auth token */
  getToken: () => Promise<string | null>;

  /** Header name for the token (default: 'Authorization') */
  headerName?: string;

  /** Format the token for the header (default: 'Bearer {token}') */
  headerFormat?: (token: string) => string;

  /** Called when request is unauthorized (401) */
  onUnauthorized?: (ctx: MiddlewareContext) => Promise<void>;

  /** Function to refresh the token */
  refreshToken?: () => Promise<string | null>;
}

/**
 * Create an auth middleware
 *
 * @example
 * const authMiddleware = createAuthMiddleware({
 *   getToken: async () => localStorage.getItem('token'),
 *   refreshToken: async () => {
 *     const response = await fetch('/auth/refresh');
 *     const { token } = await response.json();
 *     localStorage.setItem('token', token);
 *     return token;
 *   },
 *   onUnauthorized: async () => {
 *     window.location.href = '/login';
 *   },
 * });
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig): Middleware {
  const {
    getToken,
    headerName = 'Authorization',
    headerFormat = (token) => `Bearer ${token}`,
    onUnauthorized,
    refreshToken,
  } = config;

  // Track refresh state to prevent multiple simultaneous refreshes
  let isRefreshing = false;
  let refreshPromise: Promise<string | null> | null = null;

  return {
    name: 'auth',

    async before(ctx) {
      const token = await getToken();

      if (token) {
        ctx.headers = {
          ...ctx.headers,
          [headerName]: headerFormat(token),
        };
      }
    },

    async onError(ctx, error) {
      // Handle 401 Unauthorized
      if (error instanceof AdapterError && error.status === 401) {
        // Try to refresh token
        if (refreshToken && !isRefreshing) {
          isRefreshing = true;
          refreshPromise = refreshToken();

          try {
            const newToken = await refreshPromise;
            isRefreshing = false;
            refreshPromise = null;

            if (newToken) {
              // Retry with new token
              ctx.headers = {
                ...ctx.headers,
                [headerName]: headerFormat(newToken),
              };
              return { context: ctx };
            }
          } catch (refreshError) {
            isRefreshing = false;
            refreshPromise = null;
          }
        } else if (isRefreshing && refreshPromise) {
          // Wait for ongoing refresh
          try {
            const newToken = await refreshPromise;
            if (newToken) {
              ctx.headers = {
                ...ctx.headers,
                [headerName]: headerFormat(newToken),
              };
              return { context: ctx };
            }
          } catch {
            // Refresh failed
          }
        }

        // Token refresh failed or not available
        if (onUnauthorized) {
          await onUnauthorized(ctx);
        }
      }

      // Re-throw error
      return { error };
    },
  };
}
