/**
 * @mockdata/middleware
 *
 * Composable middleware for cross-cutting concerns.
 */

// Types
export type {
  Middleware,
  MiddlewareContext,
  MiddlewareResult,
  MiddlewareFactory,
} from './types';

// Built-in middleware
export { createAuthMiddleware } from './auth';
export type { AuthMiddlewareConfig } from './auth';

export { createRetryMiddleware } from './retry';
export type { RetryMiddlewareConfig } from './retry';

// Additional middleware would be exported here:
// export { createCacheMiddleware } from './cache';
// export { createLoggerMiddleware } from './logger';
