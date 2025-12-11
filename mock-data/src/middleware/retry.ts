/**
 * Retry Middleware
 *
 * Automatically retry failed requests with exponential backoff.
 */

import { Middleware, MiddlewareContext } from './types';
import { AdapterError } from '../adapters/types';

export interface RetryMiddlewareConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** Delay between retries in ms, or function to calculate delay */
  retryDelay?: number | ((attempt: number) => number);

  /** Function to determine if error is retryable */
  retryOn?: (error: Error) => boolean;
}

/**
 * Default exponential backoff delay
 */
function defaultRetryDelay(attempt: number): number {
  // 1s, 2s, 4s, 8s... up to 10s max
  return Math.min(1000 * Math.pow(2, attempt), 10000);
}

/**
 * Default retry condition
 */
function defaultRetryOn(error: Error): boolean {
  if (error instanceof AdapterError) {
    // Retry on server errors (5xx) and rate limiting (429)
    return error.status >= 500 || error.status === 429;
  }
  // Retry on network errors
  return (
    error.message.includes('network') ||
    error.message.includes('fetch') ||
    error.message.includes('ECONNREFUSED')
  );
}

/**
 * Create a retry middleware
 *
 * @example
 * const retryMiddleware = createRetryMiddleware({
 *   maxRetries: 3,
 *   retryDelay: (attempt) => 1000 * Math.pow(2, attempt),
 *   retryOn: (error) => error instanceof AdapterError && error.status >= 500,
 * });
 */
export function createRetryMiddleware(
  config: RetryMiddlewareConfig = {}
): Middleware {
  const {
    maxRetries = 3,
    retryDelay = defaultRetryDelay,
    retryOn = defaultRetryOn,
  } = config;

  return {
    name: 'retry',

    async onError(ctx, error) {
      const attempt = (ctx.state.retryAttempt ?? 0) + 1;

      // Check if we should retry
      if (attempt <= maxRetries && retryOn(error)) {
        // Calculate delay
        const delay =
          typeof retryDelay === 'function' ? retryDelay(attempt) : retryDelay;

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Signal retry with updated state
        return {
          context: {
            ...ctx,
            state: { ...ctx.state, retryAttempt: attempt },
          },
        };
      }

      // Max retries exceeded or error not retryable
      return { error };
    },
  };
}
