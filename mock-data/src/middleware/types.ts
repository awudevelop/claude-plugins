/**
 * Middleware types and interfaces
 *
 * Middleware provides composable cross-cutting concerns:
 * - Authentication
 * - Retry logic
 * - Caching
 * - Logging
 * - Error handling
 */

import { AdapterContext, AdapterResponse } from '../adapters/types';

/**
 * Extended context for middleware
 */
export interface MiddlewareContext extends AdapterContext {
  /** Mutable state that flows through middleware chain */
  state: Record<string, any>;
}

/**
 * Result from middleware handlers
 */
export interface MiddlewareResult<T = any> {
  /** Modified context (signals retry with new context) */
  context?: Partial<MiddlewareContext>;

  /** Short-circuit response (skip remaining middleware + adapter) */
  response?: AdapterResponse<T>;

  /** Error to throw */
  error?: Error;
}

/**
 * Middleware interface
 */
export interface Middleware {
  /** Middleware name for identification */
  name: string;

  /**
   * Run before adapter call
   *
   * @param ctx - Current context
   * @returns Modified context, short-circuit response, or void
   */
  before?: (ctx: MiddlewareContext) => Promise<MiddlewareResult | void>;

  /**
   * Run after adapter call
   *
   * @param ctx - Current context
   * @param response - Adapter response
   * @returns Modified response
   */
  after?: (
    ctx: MiddlewareContext,
    response: AdapterResponse
  ) => Promise<AdapterResponse>;

  /**
   * Run on error
   *
   * @param ctx - Current context
   * @param error - Error that occurred
   * @returns Retry context, fallback response, or re-throw error
   */
  onError?: (
    ctx: MiddlewareContext,
    error: Error
  ) => Promise<MiddlewareResult | void>;
}

/**
 * Middleware factory function type
 */
export type MiddlewareFactory<TConfig = any> = (config: TConfig) => Middleware;
